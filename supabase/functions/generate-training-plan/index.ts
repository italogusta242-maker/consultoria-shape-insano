import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (!GEMINI_KEY) throw new Error("GOOGLE_GEMINI_API_KEY not configured");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // Service role client for storage downloads
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const specialistId = claimsData.claims.sub;

    const { student_id, objective_hint } = await req.json();
    if (!student_id) throw new Error("student_id is required");

    // Fetch all student data in parallel
    const [
      profileRes,
      anamneseRes,
      assessmentRes,
      volumeLimitsRes,
      workoutsRes,
      checkinRes,
      flameRes,
      trainingPlansRes,
      exerciseLibRes,
      aiPrefsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("nome, peso, altura, sexo, nascimento, meta_peso, body_fat").eq("id", student_id).single(),
      supabase.from("anamnese").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("monthly_assessments").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("volume_limits").select("*").eq("student_id", student_id),
      supabase.from("workouts").select("group_name, exercises, effort_rating, comment, duration_seconds, started_at").eq("user_id", student_id).order("started_at", { ascending: false }).limit(20),
      supabase.from("psych_checkins").select("mood, stress, sleep_hours, sleep_quality, notes, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(14),
      supabase.from("flame_status").select("streak, state").eq("user_id", student_id).maybeSingle(),
      supabase.from("training_plans").select("title, groups, total_sessions, avaliacao_postural, pontos_melhoria, objetivo_mesociclo, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(3),
      supabase.from("exercise_library").select("name, muscle_group, equipment, default_sets, default_reps, level, category, secondary_muscles").limit(500),
      supabase.from("specialist_ai_preferences").select("*").eq("specialist_id", specialistId).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const anamnese = anamneseRes.data;
    const assessment = assessmentRes.data;
    const volumeLimits = volumeLimitsRes.data ?? [];
    const workouts = workoutsRes.data ?? [];
    const checkins = checkinRes.data ?? [];
    const flame = flameRes.data;
    const previousPlans = trainingPlansRes.data ?? [];
    const exerciseLib = exerciseLibRes.data ?? [];
    const aiPrefs = aiPrefsRes.data as any;

    // Compute analytics
    const avgEffort = workouts.length > 0
      ? (workouts.reduce((s, w) => s + (w.effort_rating ?? 0), 0) / workouts.filter(w => w.effort_rating).length).toFixed(1)
      : "N/A";
    const avgMood = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.mood, 0) / checkins.length).toFixed(1)
      : "N/A";
    const avgStress = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.stress, 0) / checkins.length).toFixed(1)
      : "N/A";
    const avgSleep = checkins.filter(c => c.sleep_hours).length > 0
      ? (checkins.reduce((s, c) => s + (c.sleep_hours ?? 0), 0) / checkins.filter(c => c.sleep_hours).length).toFixed(1)
      : "N/A";
    const workoutComments = workouts.filter(w => w.comment).map(w => w.comment).slice(0, 10);
    const streak = flame?.streak ?? 0;

    // Build specialist style context
    let specialistStyle = "";
    if (aiPrefs) {
      specialistStyle = `
## ESTILO DO ESPECIALISTA (IMITE ESTE ESTILO!)
O especialista quer que você gere treinos EXATAMENTE como ele faria. Siga essas diretrizes:

- Filosofia de treino: ${aiPrefs.training_philosophy || "Não definida"}
- Métodos preferidos: ${aiPrefs.preferred_methods || "Não definidos"}
- Preferências de volume: ${aiPrefs.volume_preferences || "Não definidas"}
- Exercícios preferidos: ${aiPrefs.exercise_preferences || "Não definidos"}
- Estilo de periodização: ${aiPrefs.periodization_style || "Não definido"}
- Notas adicionais: ${aiPrefs.notes || "Nenhuma"}
${aiPrefs.example_plans && (aiPrefs.example_plans as any[]).length > 0 ? `- Exemplos de planos anteriores que refletem seu estilo: ${JSON.stringify(aiPrefs.example_plans)}` : ""}
`;
    }

    // Build volume limits context
    const volumeCtx = volumeLimits.length > 0
      ? volumeLimits.map(v => `${v.muscle_group}: ${v.min_sets}-${v.max_sets} séries/semana`).join("\n")
      : "Não definidos";

    // Available exercises
    const exercisesByGroup: Record<string, string[]> = {};
    for (const e of exerciseLib) {
      if (!exercisesByGroup[e.muscle_group]) exercisesByGroup[e.muscle_group] = [];
      if (exercisesByGroup[e.muscle_group].length < 15) {
        exercisesByGroup[e.muscle_group].push(e.name);
      }
    }

    // Use custom system prompt if defined, otherwise use default
    const customSystemPrompt = aiPrefs?.system_prompt?.trim();
    const systemPrompt = customSystemPrompt
      ? `${customSystemPrompt}

${specialistStyle}

REGRAS TÉCNICAS OBRIGATÓRIAS:
1. Use APENAS exercícios da biblioteca disponível (listada abaixo)
2. Respeite os limites de volume por grupo muscular quando definidos
3. Considere lesões, limitações e equipamentos disponíveis da anamnese
4. Retorne APENAS o JSON válido no formato especificado, sem texto adicional

FORMATO DE SAÍDA (JSON):
{
  "title": "Nome do Plano",
  "total_sessions": 50,
  "avaliacao_postural": "Texto da avaliação postural baseada nos dados",
  "pontos_melhoria": "Grupos musculares e aspectos a melhorar",
  "objetivo_mesociclo": "Objetivo principal deste ciclo",
  "groups": [
    {
      "name": "A - Peito e Tríceps",
      "exercises": [
        {
          "name": "Nome Exato do Exercício (da biblioteca)",
          "sets": 4,
          "reps": "8-12",
          "weight": null,
          "rest": "90s",
          "videoId": null,
          "setsData": [],
          "freeText": false,
          "description": "Instruções específicas para este aluno"
        }
      ]
    }
  ]
}`
      : `Você é um assistente de prescrição de treinos de musculação/preparação física. 
Gere planos de treino profissionais, detalhados e individualizados.

${specialistStyle}

REGRAS IMPORTANTES:
1. Use APENAS exercícios da biblioteca disponível (listada abaixo)
2. Respeite os limites de volume por grupo muscular quando definidos
3. Considere lesões, limitações e equipamentos disponíveis da anamnese
4. Analise o histórico de treinos e feedback do aluno para progressão adequada
5. Considere o estado mental (sono, estresse, humor) para ajustar intensidade
6. Retorne APENAS o JSON válido no formato especificado, sem texto adicional

FORMATO DE SAÍDA (JSON):
{
  "title": "Nome do Plano",
  "total_sessions": 50,
  "avaliacao_postural": "Texto da avaliação postural baseada nos dados",
  "pontos_melhoria": "Grupos musculares e aspectos a melhorar",
  "objetivo_mesociclo": "Objetivo principal deste ciclo",
  "groups": [
    {
      "name": "A - Peito e Tríceps",
      "exercises": [
        {
          "name": "Nome Exato do Exercício (da biblioteca)",
          "sets": 4,
          "reps": "8-12",
          "weight": null,
          "rest": "90s",
          "videoId": null,
          "setsData": [],
          "freeText": false,
          "description": "Instruções específicas para este aluno"
        }
      ]
    }
  ]
}`;

    const userPrompt = `Gere um plano de treino personalizado para este aluno:

## PERFIL DO ALUNO
- Nome: ${profile?.nome || "N/A"}
- Peso: ${profile?.peso || "N/A"} | Altura: ${profile?.altura || "N/A"} | Sexo: ${profile?.sexo || "N/A"}
- Gordura corporal: ${profile?.body_fat ? profile.body_fat + "%" : "N/A"}
- Meta de peso: ${profile?.meta_peso || "N/A"}

## ANAMNESE
- Objetivo: ${anamnese?.objetivo || "N/A"}
- Experiência: ${anamnese?.experiencia_treino || "N/A"}
- Frequência: ${anamnese?.frequencia_treino || "N/A"}
- Local: ${anamnese?.local_treino || "N/A"}
- Equipamentos: ${anamnese?.equipamentos || "N/A"}
- Lesões: ${anamnese?.lesoes || "Nenhuma"}
- Condições de saúde: ${anamnese?.condicoes_saude || "Nenhuma"}
- Disponibilidade: ${anamnese?.disponibilidade_treino || "N/A"}
- Motivação: ${anamnese?.motivacao || "N/A"}

## ASSESSMENT MENSAL RECENTE
- Objetivo atual: ${assessment?.objetivo_atual || "N/A"}
- Nível de fadiga: ${assessment?.nivel_fadiga ?? "N/A"}/10
- Adesão treinos: ${assessment?.adesao_treinos ?? "N/A"}%
- Adesão cardios: ${assessment?.adesao_cardios ?? "N/A"}%
- Prioridades físicas: ${assessment?.prioridades_fisicas || "N/A"}
- Tempo disponível: ${assessment?.tempo_disponivel || "N/A"}
- Dias disponíveis: ${assessment?.dias_disponiveis?.join(", ") || "N/A"}
- Máquinas indisponíveis: ${assessment?.maquinas_indisponiveis?.join(", ") || "Nenhuma"}
- Notas de progressão: ${assessment?.notas_progressao || "N/A"}

## LIMITES DE VOLUME (séries/semana por grupo)
${volumeCtx}

## ESTADO MENTAL (últimos 14 dias)
- Humor médio: ${avgMood}/5
- Estresse médio: ${avgStress}/5
- Sono médio: ${avgSleep}h
- Constância (streak): ${streak} dias

## PERFORMANCE DOS TREINOS (últimos 20)
- Esforço médio (RPE): ${avgEffort}/10
- Observações do aluno nos treinos:
${workoutComments.length > 0 ? workoutComments.map(c => `  - "${c}"`).join("\n") : "  Nenhuma observação"}

## HISTÓRICO DE PLANOS ANTERIORES
${previousPlans.length > 0
  ? previousPlans.map(p => `- "${p.title}" | Objetivo: ${p.objetivo_mesociclo || "N/A"} | Grupos: ${(p.groups as any[])?.length || 0}`).join("\n")
  : "Nenhum plano anterior"}

## EXERCÍCIOS DISPONÍVEIS NA BIBLIOTECA (use APENAS estes nomes)
${Object.entries(exercisesByGroup).map(([group, exs]) => `### ${group}\n${exs.join(", ")}`).join("\n\n")}

${objective_hint ? `## INSTRUÇÃO ADICIONAL DO ESPECIALISTA\n${objective_hint}` : ""}

Gere o plano agora. Responda APENAS com o JSON válido.`;

    // Build Gemini content parts - include PDF if available
    const contentParts: any[] = [];

    // Try to download knowledge base PDF
    const pdfPath = aiPrefs?.knowledge_base_pdf_path;
    if (pdfPath) {
      try {
        const { data: pdfData, error: pdfError } = await supabaseAdmin.storage
          .from("ai-knowledge")
          .download(pdfPath);

        if (!pdfError && pdfData) {
          const arrayBuffer = await pdfData.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          let binary = "";
          for (let i = 0; i < bytes.length; i++) {
            binary += String.fromCharCode(bytes[i]);
          }
          const base64 = btoa(binary);

          contentParts.push({
            inline_data: {
              mime_type: "application/pdf",
              data: base64,
            },
          });
          console.log("Knowledge base PDF injected successfully");
        } else {
          console.warn("Could not download knowledge PDF:", pdfError?.message);
        }
      } catch (pdfErr) {
        console.warn("PDF download failed, proceeding without it:", pdfErr);
      }
    }

    // Add text prompt
    contentParts.push({ text: systemPrompt + "\n\n" + userPrompt });

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: contentParts },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 32768,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const candidate = geminiData.candidates?.[0];
    
    // Check for blocked/filtered responses
    if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
      console.error("Gemini blocked response:", JSON.stringify(candidate?.safetyRatings));
      throw new Error("A IA não conseguiu gerar o plano. Tente novamente com instruções diferentes.");
    }

    const rawText = candidate.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("Empty Gemini response. Full payload:", JSON.stringify(geminiData).slice(0, 500));
      throw new Error("Resposta vazia da IA. Tente novamente.");
    }

    // Parse JSON - handle markdown code blocks and extra text
    let planJson;
    try {
      planJson = JSON.parse(rawText);
    } catch {
      try {
        const cleaned = rawText.replace(/```(?:json)?\n?/g, "").replace(/```\n?/g, "").trim();
        planJson = JSON.parse(cleaned);
      } catch {
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            planJson = JSON.parse(jsonMatch[0]);
          } catch {
            console.error("Failed all JSON parse attempts. Raw (first 1000 chars):", rawText.slice(0, 1000));
            throw new Error("Falha ao interpretar resposta da IA. Tente novamente.");
          }
        } else {
          console.error("No JSON object found in response. Raw (first 1000 chars):", rawText.slice(0, 1000));
          throw new Error("Falha ao interpretar resposta da IA. Tente novamente.");
        }
      }
    }

    return new Response(JSON.stringify({ plan: planJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-training-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
