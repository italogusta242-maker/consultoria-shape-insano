import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: caller } } = await callerClient.auth.getUser();
    if (!caller) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all profiles with email + CPF
    const { data: profiles, error: profErr } = await supabase
      .from("profiles")
      .select("id, email, cpf, nome")
      .not("email", "is", null)
      .not("cpf", "is", null)
      .neq("cpf", "");

    if (profErr) throw profErr;
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles found", created: 0, skipped: 0, errors: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { created: 0, skipped: 0, errors: [] as string[] };

    for (const profile of profiles) {
      const email = profile.email?.trim().toLowerCase();
      const cpf = profile.cpf?.replace(/\D/g, "");

      if (!email || !cpf || cpf.length < 11) {
        results.errors.push(`${profile.nome || email}: CPF inválido (${cpf?.length || 0} dígitos)`);
        continue;
      }

      // Try creating auth user with the SAME ID as the profile
      const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
        id: profile.id,
        email,
        password: cpf,
        email_confirm: true,
        user_metadata: { nome: profile.nome },
      });

      if (createErr) {
        const msg = createErr.message || "";
        if (msg.includes("already been registered") || msg.includes("already exists") || msg.includes("duplicate")) {
          results.skipped++;
        } else {
          results.errors.push(`${profile.nome || email}: ${msg}`);
        }
        continue;
      }

      if (newUser?.user) {
        // Add 'user' role
        await supabase.from("user_roles").upsert(
          { user_id: newUser.user.id, role: "user" },
          { onConflict: "user_id,role" }
        );
        results.created++;
      }
    }

    console.log(`[bulk-create-users] Created: ${results.created}, Skipped: ${results.skipped}, Errors: ${results.errors.length}`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[bulk-create-users] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
