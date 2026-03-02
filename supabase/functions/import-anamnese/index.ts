import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin");

    if (!roles || roles.length === 0) {
      return new Response(JSON.stringify({ error: "Permissão negada" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { rows } = await req.json() as {
      rows: {
        profile: Record<string, string>;
        anamnese: Record<string, string>;
        dados_extras: Record<string, any>;
        timestamp: string;
      }[];
    };

    // Parse DD/MM/YYYY HH:MM:SS to ISO date
    function parseTimestamp(ts: string): string | null {
      if (!ts) return null;
      const match = ts.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):(\d{2})$/);
      if (!match) return null;
      const [, day, month, year, hour, min, sec] = match;
      return `${year}-${month}-${day}T${hour}:${min}:${sec}-03:00`;
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "Nenhum dado para importar" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = { imported: 0, updated: 0, errors: [] as string[] };

    for (const row of rows) {
      try {
        const email = row.profile.email;
        if (!email) {
          results.errors.push(`Linha sem email - pulada`);
          continue;
        }

        // Check if user already exists by email
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existingUser = existingUsers?.users?.find(
          (u: any) => u.email?.toLowerCase() === email.toLowerCase()
        );

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;

          // Update profile with CSV data
          const profileUpdate: Record<string, any> = {};
          for (const [key, value] of Object.entries(row.profile)) {
            if (key === 'email') continue; // don't overwrite email
            if (value) profileUpdate[key] = value;
          }
          if (Object.keys(profileUpdate).length > 0) {
            profileUpdate.onboarded = true;
            await supabase.from("profiles").update(profileUpdate).eq("id", userId);
          }

          // Check if anamnese exists
          const { data: existingAnamnese } = await supabase
            .from("anamnese")
            .select("id")
            .eq("user_id", userId)
            .limit(1);

          if (existingAnamnese && existingAnamnese.length > 0) {
            // Update existing anamnese
            const anamneseUpdate: Record<string, any> = { ...row.anamnese };
            anamneseUpdate.dados_extras = row.dados_extras;
            await supabase.from("anamnese").update(anamneseUpdate).eq("id", existingAnamnese[0].id);
            results.updated++;
          } else {
            // Insert new anamnese
            const anamneseInsert: Record<string, any> = {
              user_id: userId,
              ...row.anamnese,
              dados_extras: row.dados_extras,
            };
            const parsedTs = parseTimestamp(row.timestamp);
            if (parsedTs) anamneseInsert.created_at = parsedTs;
            await supabase.from("anamnese").insert(anamneseInsert);
            results.imported++;
          }
        } else {
          // Create new user
          const cpf = row.profile.cpf?.replace(/\D/g, '') || '';
          const password = cpf.slice(0, 6) || email.split('@')[0] + '2025';

          const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { nome: row.profile.nome || '' },
          });

          if (createError) {
            results.errors.push(`${email}: ${createError.message}`);
            continue;
          }

          userId = newUser.user.id;

          // Update profile (created by trigger)
          const profileUpdate: Record<string, any> = {};
          for (const [key, value] of Object.entries(row.profile)) {
            if (key === 'email') continue;
            if (value) profileUpdate[key] = value;
          }
          profileUpdate.onboarded = true;

          // Small delay to let trigger create profile
          await new Promise(r => setTimeout(r, 500));

          await supabase.from("profiles").update(profileUpdate).eq("id", userId);

          // Add user role
          await supabase.from("user_roles").insert({ user_id: userId, role: "user" });

          // Insert anamnese
          const anamneseInsert: Record<string, any> = {
            user_id: userId,
            ...row.anamnese,
            dados_extras: row.dados_extras,
          };
          const parsedTs = parseTimestamp(row.timestamp);
          if (parsedTs) anamneseInsert.created_at = parsedTs;
          await supabase.from("anamnese").insert(anamneseInsert);

          results.imported++;
        }
      } catch (rowError: any) {
        const email = row.profile?.email || 'desconhecido';
        results.errors.push(`${email}: ${rowError.message}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
