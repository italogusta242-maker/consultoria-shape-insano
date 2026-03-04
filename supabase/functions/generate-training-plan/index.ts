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

    const startTime = Date.now();
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
      likedLogsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("nome, peso, altura, sexo, nascimento, meta_peso, body_fat").eq("id", student_id).single(),
      supabase.from("anamnese").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("monthly_assessments").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("volume_limits").select("*").eq("student_id", student_id),
      supabase.from("workouts").select("group_name, exercises, effort_rating, comment, duration_seconds, started_at").eq("user_id", student_id).order("started_at", { ascending: false }).limit(20),
      supabase.from("psych_checkins").select("mood, stress, sleep_hours, sleep_quality, notes, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(14),
      supabase.from("flame_status").select("streak, state").eq("user_id", student_id).maybeSingle(),
      supabase.from("training_plans").select("title, groups, total_sessions, avaliacao_postural, pontos_melhoria, objetivo_mesociclo, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(3),
      supabase.from("exercise_library").select("id, name, muscle_group, equipment, default_sets, default_reps, level, category, secondary_muscles, video_id").limit(1000),
      supabase.from("specialist_ai_preferences").select("*").eq("specialist_id", specialistId).maybeSingle(),
      supabase.from("ai_generation_logs").select("generated_content").eq("specialist_id", specialistId).eq("feedback", "like").order("created_at", { ascending: false }).limit(2),
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
    const likedLogs = likedLogsRes.data ?? [];

    // Build RLHF gold standard examples
    let rlhfContext = "";
    if (likedLogs.length > 0) {
      rlhfContext = `\n\n## EXEMPLOS DE TREINOS PERFEITOS (PADRÃO OURO)
Analise os exemplos perfeitos abaixo para entender o formato exato, a distribuição de volume e o estilo de periodização que o especialista prefere. Molde sua nova resposta seguindo este mesmo padrão de excelência.

${likedLogs.map((log: any, i: number) => `### Exemplo Aprovado ${i + 1}\n${JSON.stringify(log.generated_content, null, 2)}`).join("\n\n")}

FIM DOS EXEMPLOS — siga este padrão de qualidade.`;
      console.log(`RLHF: injected ${likedLogs.length} liked examples as gold standard`);
    }

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

    // Build exercise lookup map (id -> exercise) and catalog for prompt
    const exerciseMap = new Map<string, any>();
    const exerciseNameMap = new Map<string, any>(); // lowercase name -> exercise
    const exercisesByGroup: Record<string, { id: string; name: string; equipment: string | null }[]> = {};
    for (const e of exerciseLib) {
      exerciseMap.set(e.id, e);
      exerciseNameMap.set(e.name.toLowerCase().trim(), e);
      if (!exercisesByGroup[e.muscle_group]) exercisesByGroup[e.muscle_group] = [];
      exercisesByGroup[e.muscle_group].push({ id: e.id, name: e.name, equipment: e.equipment });
    }

    // Anti-hallucination constraint block (shared by both prompt paths)
    const antiHallucinationRule = `
⚠️ RESTRIÇÃO ABSOLUTA — CATÁLOGO FECHADO ⚠️
Estás ESTRITAMENTE PROIBIDO de inventar, traduzir ou sugerir exercícios que NÃO constem no catálogo fornecido abaixo.
Para CADA exercício no plano, deves:
1. Copiar o "name" EXATAMENTE como aparece no catálogo (case-sensitive, sem alterações).
2. Incluir o campo "exercise_id" com o UUID exato correspondente do catálogo.
Se não encontrares um exercício adequado no catálogo, escolhe a alternativa mais próxima que EXISTA. NUNCA inventes nomes.`;

    const jsonSchema = `
FORMATO DE SAÍDA (JSON estrito):
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
          "exercise_id": "uuid-do-exercicio-do-catalogo",
          "name": "Nome Exato do Exercício (copiado do catálogo)",
          "sets": 3,
          "reps": "6-8",
          "weight": null,
          "rest": "1'30''",
          "videoId": null,
          "setsData": [],
          "freeText": false,
          "description": "Warm-up\n15 reps carga leve\n10 reps carga moderada\n\nFeeder sets\n6 reps\n4 reps\n\nWorking sets\n3 × 6–8 reps\n\nTop set\n1 × 6 reps (RPE 9)"
        }
      ]
    }
  ]
}

REGRAS DO CAMPO "description" (OBRIGATÓRIO para cada exercício):
O campo "description" deve conter a prescrição completa e detalhada de TODAS as séries do exercício, formatada em blocos separados por linha em branco, seguindo este padrão:

Warm-up (se aplicável)
[quantidade] reps carga leve
[quantidade] reps carga moderada

Feeder sets (se aplicável)
[quantidade] reps
[quantidade] reps

Working sets (OBRIGATÓRIO — este é o bloco principal)
[sets] × [reps] reps

Top set (se aplicável ao nível do aluno — NÃO prescreva para iniciantes)
1 × [reps] reps (RPE [valor])

O campo "sets" deve conter APENAS a quantidade de Working Sets (ex: 3).
O campo "reps" deve conter APENAS o range de reps dos Working Sets (ex: "6-8").

REGRAS DO CAMPO "rest" (tempo de descanso):
Use o formato em minutos e segundos: "1'30''" para 1 minuto e 30 segundos, "2'" para 2 minutos, "45''" para 45 segundos.
NUNCA use o formato "90s" ou "120s". Sempre converta para minutos/segundos.`;

    // Build system instruction: env var > specialist custom prompt > default
    const envSystemPrompt = Deno.env.get("SPECIALIST_SYSTEM_PROMPT")?.trim();
    const customSystemPrompt = aiPrefs?.system_prompt?.trim();

    const baseSystemPrompt = envSystemPrompt
      || customSystemPrompt
      || `Você é um assistente de prescrição de treinos de musculação/preparação física. 
Gere planos de treino profissionais, detalhados e individualizados.`;

    const systemInstruction = `${baseSystemPrompt}

${specialistStyle}

${antiHallucinationRule}

REGRAS TÉCNICAS OBRIGATÓRIAS:
1. Use APENAS exercícios do catálogo (com exercise_id obrigatório).
2. Respeite os limites de volume por grupo muscular quando definidos.
3. Considere lesões, limitações e equipamentos disponíveis da anamnese.
4. Analise o histórico de treinos e feedback do aluno para progressão adequada.
5. Considere o estado mental (sono, estresse, humor) para ajustar intensidade.
6. Retorne APENAS o JSON válido no formato especificado, sem texto adicional.

${jsonSchema}`;
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

## CATÁLOGO DE EXERCÍCIOS (use APENAS estes — inclua o exercise_id no output)
${Object.entries(exercisesByGroup).map(([group, exs]) => `### ${group}\n${exs.map(e => `- [${e.id}] ${e.name}${e.equipment ? ` (${e.equipment})` : ""}`).join("\n")}`).join("\n\n")}

${objective_hint ? `## INSTRUÇÃO ADICIONAL DO ESPECIALISTA\n${objective_hint}` : ""}

Gere o plano agora. Responda APENAS com o JSON válido.`;

    // RAG: Retrieve relevant knowledge base context
    let ragContext = "";
    try {
      // Build a query embedding from the student context
      const ragQuery = `treino ${anamnese?.objetivo || ""} ${anamnese?.experiencia_treino || ""} ${assessment?.prioridades_fisicas || ""} ${objective_hint || ""}`.trim();
      
      if (ragQuery.length > 10) {
        // Generate embedding for the query
        const embResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${GEMINI_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "models/text-embedding-004",
              content: { parts: [{ text: ragQuery }] },
              taskType: "RETRIEVAL_QUERY",
            }),
          }
        );

        if (embResponse.ok) {
          const embData = await embResponse.json();
          const queryEmbedding = embData.embedding?.values;

          if (queryEmbedding) {
            // Search for relevant chunks
            const { data: matchedDocs, error: matchErr } = await supabaseAdmin.rpc("match_documents", {
              query_embedding: JSON.stringify(queryEmbedding),
              match_count: 8,
              match_threshold: 0.5,
              filter_specialist_id: specialistId,
            });

            if (!matchErr && matchedDocs && matchedDocs.length > 0) {
              ragContext = `\n\n## BASE DE CONHECIMENTO DO ESPECIALISTA (use como diretriz principal)
Utilize o contexto abaixo como sua principal diretriz e base de conhecimento para fundamentar suas decisões de prescrição.
Os trechos a seguir foram extraídos do material de referência do especialista:

${matchedDocs.map((doc: any, i: number) => `### Referência ${i + 1} (relevância: ${(doc.similarity * 100).toFixed(0)}%)\n${doc.content}`).join("\n\n")}

FIM DA BASE DE CONHECIMENTO — aplique estes princípios ao plano gerado.`;
              console.log(`RAG: injected ${matchedDocs.length} knowledge chunks (best similarity: ${(matchedDocs[0].similarity * 100).toFixed(0)}%)`);
            } else {
              console.log("RAG: no matching documents found", matchErr?.message);
            }
          }
        } else {
          console.warn("RAG embedding generation failed:", embResponse.status);
        }
      }
    } catch (ragErr) {
      console.warn("RAG retrieval failed, proceeding without knowledge context:", ragErr);
    }

    // Build Gemini content parts
    const contentParts: any[] = [];

    // Try to download knowledge base PDF (legacy support)
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

    // Add text prompt with RAG context injected
    contentParts.push({ text: ragContext + rlhfContext + "\n\n" + userPrompt });

    // Call Gemini API with systemInstruction
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemInstruction }],
          },
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

    // MAP etapa-based schema to frontend format if needed
    if (planJson.etapa_5_treino && !planJson.groups) {
      console.log("Mapping etapa-based schema to frontend format");
      planJson.avaliacao_postural = planJson.etapa_2_analise_postural || planJson.avaliacao_postural || null;
      planJson.pontos_melhoria = Array.isArray(planJson.etapa_3_pontos_melhoria)
        ? planJson.etapa_3_pontos_melhoria.join("; ")
        : planJson.pontos_melhoria || null;
      planJson.objetivo_mesociclo = planJson.etapa_4_mesociclo?.diretriz || planJson.objetivo_mesociclo || null;
      planJson.title = planJson.title || `Mesociclo ${planJson.etapa_4_mesociclo?.duracao || "4 semanas"}`;
      planJson.total_sessions = planJson.total_sessions || 50;

      planJson.groups = planJson.etapa_5_treino.map((dia: any) => ({
        name: `${dia.dia} - ${dia.foco}`,
        exercises: (dia.exercicios || []).map((ex: any) => {
          // Convert rest from "90s" format to "1'30''" format if needed
          let rest = ex.descanso || ex.rest || "1'30''";
          const secMatch = rest.match(/^(\d+)s$/);
          if (secMatch) {
            const totalSec = parseInt(secMatch[1]);
            const mins = Math.floor(totalSec / 60);
            const secs = totalSec % 60;
            rest = mins > 0
              ? (secs > 0 ? `${mins}'${secs}''` : `${mins}'`)
              : `${totalSec}''`;
          }
          return {
            exercise_id: ex.exercise_id || null,
            name: ex.nome || ex.name || "Exercício",
            sets: typeof ex.sets === "number" ? ex.sets : parseInt(String(ex.sets).match(/\d+/)?.[0] || "3"),
            reps: ex.reps || "8-12",
            weight: null,
            rest,
            videoId: null,
            setsData: [],
            freeText: false,
            description: ex.observacao_metodologica || ex.description || "",
          };
        }),
      }));

      // Clean up etapa fields
      delete planJson.etapa_1_analise_anamnese;
      delete planJson.etapa_2_analise_postural;
      delete planJson.etapa_3_pontos_melhoria;
      delete planJson.etapa_4_mesociclo;
      delete planJson.etapa_5_treino;
    }

    // Normalize rest format: convert "90s" -> "1'30''" across all exercises
    if (planJson.groups && Array.isArray(planJson.groups)) {
      for (const group of planJson.groups) {
        if (!group.exercises || !Array.isArray(group.exercises)) continue;
        for (const ex of group.exercises) {
          if (ex.rest) {
            const secMatch = ex.rest.match(/^(\d+)s$/);
            if (secMatch) {
              const totalSec = parseInt(secMatch[1]);
              const mins = Math.floor(totalSec / 60);
              const secs = totalSec % 60;
              ex.rest = mins > 0
                ? (secs > 0 ? `${mins}'${secs}''` : `${mins}'`)
                : `${totalSec}''`;
            }
          }
        }
      }
    }

    // POST-GENERATION VALIDATION: resolve exercise_ids and fix hallucinated names
    let hallucinated = 0;
    let resolved = 0;
    if (planJson.groups && Array.isArray(planJson.groups)) {
      for (const group of planJson.groups) {
        if (!group.exercises || !Array.isArray(group.exercises)) continue;
        for (const ex of group.exercises) {
          // Case 1: exercise_id provided — validate it exists
          if (ex.exercise_id && exerciseMap.has(ex.exercise_id)) {
            const real = exerciseMap.get(ex.exercise_id)!;
            ex.name = real.name; // force correct name
            ex.videoId = real.video_id || null;
            resolved++;
            continue;
          }

          // Case 2: try to match by name (fuzzy)
          const nameKey = (ex.name || "").toLowerCase().trim();
          if (exerciseNameMap.has(nameKey)) {
            const real = exerciseNameMap.get(nameKey)!;
            ex.exercise_id = real.id;
            ex.name = real.name;
            ex.videoId = real.video_id || null;
            resolved++;
            continue;
          }

          // Case 3: partial match — find best candidate
          let bestMatch: any = null;
          let bestScore = 0;
          for (const [libName, libEx] of exerciseNameMap.entries()) {
            // Simple substring matching
            if (nameKey.includes(libName) || libName.includes(nameKey)) {
              const score = libName.length;
              if (score > bestScore) {
                bestScore = score;
                bestMatch = libEx;
              }
            }
          }

          if (bestMatch) {
            console.warn(`Fuzzy matched "${ex.name}" -> "${bestMatch.name}" (${bestMatch.id})`);
            ex.exercise_id = bestMatch.id;
            ex.name = bestMatch.name;
            ex.videoId = bestMatch.video_id || null;
            resolved++;
          } else {
            // Hallucinated exercise — flag it but don't remove
            console.warn(`HALLUCINATED exercise: "${ex.name}" — no match in library`);
            ex.exercise_id = null;
            ex.freeText = true; // mark as free text so frontend knows
            hallucinated++;
          }
        }
      }
    }

    console.log(`Exercise validation: ${resolved} resolved, ${hallucinated} hallucinated out of ${resolved + hallucinated} total`);

    // Log the generation for RLHF feedback loop
    const latencyMs = Date.now() - startTime;
    let logId: string | null = null;
    try {
      const promptSummary = `Student: ${profile?.nome || student_id} | Objective: ${anamnese?.objetivo || objective_hint || "N/A"}`;
      const { data: logData } = await supabaseAdmin.from("ai_generation_logs").insert({
        specialist_id: specialistId,
        student_id: student_id,
        prompt_context: promptSummary,
        generated_content: planJson,
        latency_ms: latencyMs,
      }).select("id").single();
      logId = logData?.id || null;
      console.log(`Generation logged: ${logId} (${latencyMs}ms)`);
    } catch (logErr) {
      console.warn("Failed to log generation:", logErr);
    }

    return new Response(JSON.stringify({ plan: planJson, log_id: logId, _meta: { resolved, hallucinated, latency_ms: latencyMs } }), {
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
