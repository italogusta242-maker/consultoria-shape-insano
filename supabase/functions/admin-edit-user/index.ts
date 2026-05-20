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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify caller is admin
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

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem editar contas" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { user_id, nome, email, telefone, cpf, password, status, streak, flameState } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update auth user (email and/or password) if provided
    const authUpdate: Record<string, any> = {};
    if (email) authUpdate.email = email;
    if (password) authUpdate.password = password;

    if (Object.keys(authUpdate).length > 0) {
      // When changing email, confirm it immediately
      if (email) authUpdate.email_confirm = true;

      const { error: authError } = await adminClient.auth.admin.updateUserById(user_id, authUpdate);
      if (authError) {
        const msg = authError.message.includes("already been registered")
          ? "Este e-mail já está em uso por outra conta."
          : authError.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update profile fields
    const profileUpdate: Record<string, any> = {};
    if (nome !== undefined) profileUpdate.nome = nome;
    if (email !== undefined) profileUpdate.email = email;
    if (telefone !== undefined) profileUpdate.telefone = telefone;
    if (cpf !== undefined) profileUpdate.cpf = cpf;
    if (status !== undefined) profileUpdate.status = status;

    if (Object.keys(profileUpdate).length > 0) {
      const { error: profileError } = await adminClient
        .from("profiles")
        .update(profileUpdate)
        .eq("id", user_id);

      if (profileError) {
        console.error("Profile update error:", profileError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar perfil: " + profileError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Update flame status if provided
    if (streak !== undefined || flameState !== undefined) {
      const flameUpdate: Record<string, any> = {
        user_id,
        updated_at: new Date().toISOString(),
      };
      if (streak !== undefined) flameUpdate.streak = Number(streak);
      if (flameState !== undefined) flameUpdate.state = flameState;

      // To prevent the midnight judge from resetting this manual edit today:
      // We get the user's timezone to compute today's local date string
      const { data: profile } = await adminClient
        .from("profiles")
        .select("timezone")
        .eq("id", user_id)
        .maybeSingle();

      const userTimezone = profile?.timezone || "America/Sao_Paulo";
      
      // Compute correct date string in user's timezone (YYYY-MM-DD)
      const formatter = new Intl.DateTimeFormat("en-US", {
        timeZone: userTimezone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      });
      const parts = formatter.formatToParts(new Date());
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      const localTodayStr = `${year}-${month}-${day}`;

      if (flameState === "ativa") {
        flameUpdate.last_approved_date = localTodayStr;
      }
      flameUpdate.last_midnight_check = localTodayStr;

      const { error: flameError } = await adminClient
        .from("flame_status")
        .upsert(flameUpdate, { onConflict: "user_id" });

      if (flameError) {
        console.error("Flame status update error:", flameError);
        return new Response(JSON.stringify({ error: "Erro ao atualizar Chama de Honra: " + flameError.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
