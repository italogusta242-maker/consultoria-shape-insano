import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Verify the caller is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin using their token
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem criar contas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { email, password, nome, telefone, nascimento, peso, altura, objetivo, experiencia, localTreino, plano, skipOnboarding, cpf, role } = await req.json();

    if (!email || !password || !nome) {
      return new Response(JSON.stringify({ error: "Email, senha e nome são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create user with email confirmed
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { nome },
    });

    if (createError) {
      const msg = createError.message.includes("already been registered")
        ? "Este e-mail já está cadastrado no sistema. Use outro e-mail ou exclua a conta existente primeiro."
        : createError.message;
      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update profile with all provided data
    const profileUpdate: Record<string, any> = { nome, email };
    if (telefone) profileUpdate.telefone = telefone;
    if (cpf) profileUpdate.cpf = cpf;
    if (nascimento) profileUpdate.nascimento = nascimento;
    if (peso) profileUpdate.peso = peso;
    if (altura) profileUpdate.altura = altura;

    if (skipOnboarding) {
      profileUpdate.onboarded = true;
      profileUpdate.status = "ativo";
    }

    const { error: profileError } = await adminClient
      .from("profiles")
      .update(profileUpdate)
      .eq("id", newUser.user.id);

    if (profileError) {
      console.error("Profile update error:", profileError);
    }

    // Assign role if provided (default is 'user' which is handled by trigger)
    if (role && role !== "user") {
      const { error: roleError } = await adminClient
        .from("user_roles")
        .insert({ user_id: newUser.user.id, role });
      if (roleError) {
        console.error("Role insert error:", roleError);
      }
    }

    // If extra data provided, create a partial anamnese
    if (objetivo || experiencia || localTreino) {
      const { error: anamneseError } = await adminClient
        .from("anamnese")
        .insert({
          user_id: newUser.user.id,
          objetivo: objetivo || null,
          experiencia_treino: experiencia || null,
          local_treino: localTreino || null,
        });
      if (anamneseError) {
        console.error("Anamnese insert error:", anamneseError);
      }
    }

    // If plan provided, create a subscription
    if (plano) {
      const { data: planData } = await adminClient
        .from("subscription_plans")
        .select("price")
        .eq("id", plano)
        .maybeSingle();

      const { error: subError } = await adminClient
        .from("subscriptions")
        .insert({
          user_id: newUser.user.id,
          plan_price: planData?.price || 0,
          status: "active",
        });
      if (subError) {
        console.error("Subscription insert error:", subError);
      }
    }

    // Send welcome email with credentials
    try {
      const publishedUrl = "https://shapeinsano.lovable.app";
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-credentials-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": authHeader!,
          "apikey": Deno.env.get("SUPABASE_ANON_KEY")!,
        },
        body: JSON.stringify({
          to_email: email,
          to_name: nome,
          access_url: publishedUrl,
          login_email: email,
          login_password: password,
        }),
      });
      const emailData = await emailRes.json();
      if (!emailRes.ok) {
        console.error("Email send failed:", emailData);
      } else {
        console.log("Welcome email sent to:", email);
      }
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
    }

    return new Response(
      JSON.stringify({ success: true, user_id: newUser.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
