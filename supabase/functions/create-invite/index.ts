import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[create-invite] Request received");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Verify caller identity
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      console.log("[create-invite] Missing auth header");
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData, error: userError } = await callerClient.auth.getUser();
    if (userError || !userData?.user) {
      console.error("[create-invite] Auth error:", userError?.message);
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = userData.user.id;
    console.log("[create-invite] Caller:", callerId);

    // 2. Check closer or admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roles, error: rolesError } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["closer", "admin"]);

    if (rolesError) {
      console.error("[create-invite] Roles error:", rolesError.message);
    }

    if (!roles || roles.length === 0) {
      console.log("[create-invite] No closer/admin role for:", callerId);
      return new Response(JSON.stringify({ error: "Sem permissão" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Parse body
    const body = await req.json();
    const { name, email, cpf, plan_value, product_id } = body;
    console.log("[create-invite] Body:", JSON.stringify({ name, email, cpf: cpf ? "***" : null, plan_value, product_id }));

    if (!email) {
      return new Response(JSON.stringify({ error: "E-mail é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cpfClean = (cpf || "").replace(/\D/g, "");
    if (cpfClean.length < 11) {
      return new Response(JSON.stringify({ error: "CPF deve ter 11 dígitos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 4. Create invite record
    const { data: invite, error: inviteError } = await adminClient
      .from("invites")
      .insert({
        email: email.toLowerCase(),
        name: name || null,
        cpf,
        plan_value: plan_value || null,
        product_id: product_id || null,
        payment_status: plan_value && plan_value > 0 ? "paid" : "pending",
        created_by: callerId,
      })
      .select("id, token")
      .single();

    if (inviteError) {
      console.error("[create-invite] Invite insert error:", inviteError.message);
      return new Response(JSON.stringify({ error: "Erro ao criar convite: " + inviteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("[create-invite] Invite created:", invite.id);

    // 5. Create user account (email + CPF as password, auto-confirmed)
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email: email.toLowerCase(),
      password: cpfClean,
      email_confirm: true,
      user_metadata: { nome: name || null },
    });

    if (createError) {
      if (!createError.message.includes("already been registered")) {
        console.error("[create-invite] User creation error:", createError.message);
        return new Response(JSON.stringify({ error: "Erro ao criar conta: " + createError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // User already exists — update password to the new CPF
      console.log("[create-invite] User already exists, updating password:", email);
      const { data: existingUsers } = await adminClient.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find((u) => u.email === email.toLowerCase());
      if (existingUser) {
        const { error: updateError } = await adminClient.auth.admin.updateUserById(existingUser.id, {
          password: cpfClean,
          email_confirm: true,
        });
        if (updateError) {
          console.error("[create-invite] Password update error:", updateError.message);
        } else {
          console.log("[create-invite] Password updated for:", existingUser.id);
        }
      }
    } else {
      console.log("[create-invite] User created:", newUser.user.id);
    }

    // 6. Mark invite as used
    await adminClient
      .from("invites")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", invite.id);

    console.log("[create-invite] Success for:", email);

    return new Response(
      JSON.stringify({
        ok: true,
        invite_id: invite.id,
        token: invite.token,
        credentials: {
          email: email.toLowerCase(),
          password: cpfClean,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: unknown) {
    console.error("[create-invite] Uncaught error:", (err as Error)?.message || err);
    return new Response(JSON.stringify({ error: "Erro interno: " + ((err as Error)?.message || "desconhecido") }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
