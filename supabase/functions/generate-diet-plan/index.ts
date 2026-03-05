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
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
    }
    const specialistId = claimsData.claims.sub;

    const { student_id, goal_hint, goal_type } = await req.json();
    if (!student_id) throw new Error("student_id is required");

    // Fetch all student data in parallel
    const [
      profileRes,
      anamneseRes,
      assessmentRes,
      workoutsRes,
      checkinRes,
      flameRes,
      dietPlansRes,
      dailyHabitsRes,
      aiPrefsRes,
    ] = await Promise.all([
      supabase.from("profiles").select("nome, peso, altura, sexo, nascimento, meta_peso, body_fat").eq("id", student_id).single(),
      supabase.from("anamnese").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("monthly_assessments").select("*").eq("user_id", student_id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("workouts").select("effort_rating, duration_seconds, started_at").eq("user_id", student_id).order("started_at", { ascending: false }).limit(20),
      supabase.from("psych_checkins").select("mood, stress, sleep_hours, sleep_quality, notes, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(14),
      supabase.from("flame_status").select("streak, state").eq("user_id", student_id).maybeSingle(),
      supabase.from("diet_plans").select("title, meals, goal, goal_description, created_at").eq("user_id", student_id).order("created_at", { ascending: false }).limit(2),
      supabase.from("daily_habits").select("water_liters, completed_meals, date").eq("user_id", student_id).order("date", { ascending: false }).limit(14),
      supabase.from("specialist_ai_preferences").select("*").eq("specialist_id", specialistId).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const anamnese = anamneseRes.data;
    const assessment = assessmentRes.data;
    const workouts = workoutsRes.data ?? [];
    const checkins = checkinRes.data ?? [];
    const flame = flameRes.data;
    const previousDiets = dietPlansRes.data ?? [];
    const dailyHabits = dailyHabitsRes.data ?? [];
    const aiPrefs = aiPrefsRes.data;

    // Compute analytics
    const avgMood = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.mood, 0) / checkins.length).toFixed(1)
      : "N/A";
    const avgStress = checkins.length > 0
      ? (checkins.reduce((s, c) => s + c.stress, 0) / checkins.length).toFixed(1)
      : "N/A";
    const avgSleep = checkins.filter(c => c.sleep_hours).length > 0
      ? (checkins.reduce((s, c) => s + (c.sleep_hours ?? 0), 0) / checkins.filter(c => c.sleep_hours).length).toFixed(1)
      : "N/A";
    const avgWater = dailyHabits.length > 0
      ? (dailyHabits.reduce((s, h) => s + Number(h.water_liters || 0), 0) / dailyHabits.length).toFixed(1)
      : "N/A";
    const avgMealsCompleted = dailyHabits.length > 0
      ? (dailyHabits.reduce((s, h) => s + (h.completed_meals?.length || 0), 0) / dailyHabits.length).toFixed(1)
      : "N/A";
    const streak = flame?.streak ?? 0;

    const avgEffort = workouts.length > 0
      ? (workouts.reduce((s, w) => s + (w.effort_rating ?? 0), 0) / workouts.filter(w => w.effort_rating).length).toFixed(1)
      : "N/A";

    // Caloric estimation (Harris-Benedict)
    let estimatedCalories = "N/A";
    if (profile?.peso) {
      const peso = parseFloat(profile.peso);
      const altura = parseFloat(profile.altura || "170");
      const isMale = profile.sexo !== "feminino";
      if (!isNaN(peso)) {
        const bmr = isMale
          ? 88.362 + 13.397 * peso + 4.799 * altura - 5.677 * 25
          : 447.593 + 9.247 * peso + 3.098 * altura - 4.330 * 25;
        estimatedCalories = String(Math.round(bmr * 1.55));
      }
    }

    // Build specialist style context
    let specialistStyle = "";
    if (aiPrefs) {
      specialistStyle = `
## ESTILO DO ESPECIALISTA (IMITE ESTE ESTILO!)
- Filosofia: ${aiPrefs.training_philosophy || "Não definida"}
- Métodos preferidos: ${aiPrefs.preferred_methods || "Não definidos"}
- Notas adicionais: ${aiPrefs.notes || "Nenhuma"}
`;
    }

    // Extract dados_extras
    const extras = (anamnese?.dados_extras && typeof anamnese.dados_extras === "object")
      ? anamnese.dados_extras as Record<string, any>
      : {};

    // Build explicit forbidden foods list
    const forbiddenFoods: string[] = [];
    if (anamnese?.restricoes_alimentares && anamnese.restricoes_alimentares.trim() !== "" && anamnese.restricoes_alimentares !== "Nenhuma" && anamnese.restricoes_alimentares !== "Não") {
      forbiddenFoods.push(anamnese.restricoes_alimentares);
    }
    if (assessment?.alimentos_proibidos && assessment.alimentos_proibidos.trim() !== "" && assessment.alimentos_proibidos !== "Nenhum") {
      forbiddenFoods.push(assessment.alimentos_proibidos);
    }
    if (assessment?.restricao_alimentar && assessment.restricao_alimentar.trim() !== "" && assessment.restricao_alimentar !== "Nenhuma") {
      forbiddenFoods.push(assessment.restricao_alimentar);
    }
    if (extras.alimentos_nao_come) forbiddenFoods.push(String(extras.alimentos_nao_come));
    if (extras.alimentos_proibidos) forbiddenFoods.push(String(extras.alimentos_proibidos));
    if (extras.alergias) forbiddenFoods.push(String(extras.alergias));
    if (extras.alergia_outra) forbiddenFoods.push(String(extras.alergia_outra));
    if (extras.intolerancias) forbiddenFoods.push(String(extras.intolerancias));

    const forbiddenSection = forbiddenFoods.length > 0
      ? `\n⛔ ALIMENTOS/INGREDIENTES ABSOLUTAMENTE PROIBIDOS (NUNCA USE ESTES NO PLANO):\n${forbiddenFoods.map(f => `- ${f}`).join("\n")}\nSe qualquer alimento listado acima aparecer no plano, o plano será REJEITADO.\n`
      : "";

    // Extract meal preferences from dados_extras
    const refeicoesDia = extras.refeicoes_dia ? String(extras.refeicoes_dia) : null;
    const horarioRefeicoes = extras.horario_refeicoes ? String(extras.horario_refeicoes) : null;
    const frutasPreferidas = extras.frutas ? String(extras.frutas) : null;
    const alimentosDiarios = extras.alimentos_diarios ? String(extras.alimentos_diarios) : null;
    const nivelAtividade = extras.nivel_atividade ? String(extras.nivel_atividade) : null;
    const investimentoDieta = extras.investimento_dieta ? String(extras.investimento_dieta) : null;
    const liquidoRefeicao = extras.liquido_refeicao ? String(extras.liquido_refeicao) : null;
    const liquidoQual = extras.liquido_qual ? String(extras.liquido_qual) : null;
    const horarioSono = extras.horario_sono ? String(extras.horario_sono) : null;
    const objetivoExtras = extras.objetivo ? String(extras.objetivo) : null;

    const mealCountRule = refeicoesDia
      ? `\n🔢 NÚMERO DE REFEIÇÕES: O aluno faz APENAS ${refeicoesDia} refeições por dia. O plano DEVE conter EXATAMENTE ${refeicoesDia} refeições, NÃO MAIS.\n`
      : "";

    const mealScheduleInfo = horarioRefeicoes
      ? `\n🕐 PREFERÊNCIAS DE REFEIÇÕES: "${horarioRefeicoes}"\nRespeite ao nomear e organizar as refeições.\n`
      : "";

    // =====================================================
    // RAG: Retrieve relevant knowledge base context via pgvector
    // =====================================================
    let ragContext = "";
    try {
      const ragQuery = `nutrição dieta ${anamnese?.objetivo || ""} ${anamnese?.restricoes_alimentares || ""} ${assessment?.adesao_dieta || ""} ${goal_hint || ""} ${goal_type || ""}`.trim();

      if (ragQuery.length > 10) {
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
          const queryEmbedding = embData?.embedding?.values;

          if (queryEmbedding) {
            const { data: matchedDocs, error: matchErr } = await supabaseAdmin.rpc("match_documents", {
              query_embedding: JSON.stringify(queryEmbedding),
              match_count: 8,
              match_threshold: 0.65,
              filter_specialist_id: specialistId,
            });

            if (!matchErr && matchedDocs && matchedDocs.length > 0) {
              ragContext = `\n\n## BASE DE CONHECIMENTO DO ESPECIALISTA (DIRETRIZ PRIMÁRIA — siga estes princípios rigorosamente)
Utilize o contexto abaixo como sua principal diretriz e base de conhecimento para fundamentar suas decisões de prescrição nutricional.
Os trechos a seguir foram extraídos do material de referência do especialista:

${matchedDocs.map((d: any, i: number) => `[Trecho ${i + 1}] ${d.content}`).join("\n\n")}

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

    // =====================================================
    // RLHF: Inject liked plans as gold standards
    // =====================================================
    let rlhfContext = "";
    try {
      const { data: likedLogs } = await supabaseAdmin
        .from("ai_generation_logs")
        .select("generated_content")
        .eq("specialist_id", specialistId)
        .eq("feedback", "like")
        .order("created_at", { ascending: false })
        .limit(3);

      if (likedLogs && likedLogs.length > 0) {
        rlhfContext = `\n\n## EXEMPLOS PADRÃO OURO (planos aprovados pelo especialista — imite o estilo)
${likedLogs.map((l: any, i: number) => {
  const content = typeof l.generated_content === "string" ? l.generated_content : JSON.stringify(l.generated_content);
  return `### Exemplo ${i + 1}:\n${content.slice(0, 3000)}`;
}).join("\n\n")}
FIM DOS EXEMPLOS — use como referência de qualidade e estilo.`;
        console.log(`RLHF: injected ${likedLogs.length} gold-standard diet plans`);
      }
    } catch (rlhfErr) {
      console.warn("RLHF retrieval failed:", rlhfErr);
    }

    // =====================================================
    // RLHF Negative: Inject dislike reasons as anti-patterns
    // =====================================================
    let rlhfNegativeContext = "";
    try {
      const { data: dislikedLogs } = await supabaseAdmin
        .from("ai_generation_logs")
        .select("dislike_reason")
        .eq("specialist_id", specialistId)
        .eq("feedback", "dislike")
        .not("dislike_reason", "is", null)
        .order("created_at", { ascending: false })
        .limit(5);

      if (dislikedLogs && dislikedLogs.length > 0) {
        const reasons = dislikedLogs.map((l: any) => l.dislike_reason).filter(Boolean);
        if (reasons.length > 0) {
          rlhfNegativeContext = `\n\n## ⚠️ ERROS A EVITAR (feedback negativo do especialista)
O especialista rejeitou planos anteriores pelos seguintes motivos. NÃO repita estes erros:
${reasons.map((r: string, i: number) => `${i + 1}. ${r}`).join("\n")}
`;
          console.log(`RLHF Negative: injected ${reasons.length} dislike reasons as anti-patterns`);
        }
      }
    } catch (rlhfNegErr) {
      console.warn("RLHF negative retrieval failed:", rlhfNegErr);
    }

    // =====================================================
    // SYSTEM PROMPT — Strict Nutritionist with Guardrails
    // =====================================================
    const systemPrompt = `[IDENTIDADE E PROPÓSITO]
Você é um nutricionista estrito e especialista em nutrição esportiva do ecossistema Shape Insano Pro. Você DEVE usar APENAS os padrões fornecidos no contexto (Base de Conhecimento do Especialista e Exemplos Padrão Ouro). Seu objetivo é desenhar estratégias nutricionais focadas em neuro-performance, altíssima adesão e resultados estéticos.

Você NÃO inventa metodologias — você aplica RIGOROSAMENTE a metodologia fornecida na Base de Conhecimento. Se nenhuma base de conhecimento for fornecida, use os princípios padrão de nutrição esportiva baseada em evidências.

${specialistStyle}

[REGRAS ESTRITAS DE ENGAJAMENTO]

1. **Realismo Brasileiro (Base TACO/TBCA):** Utilize APENAS alimentos acessíveis e comuns no Brasil (ex: arroz, feijão, ovo de galinha, pão francês, frango, patinho, cuscuz, tapioca). Proibido sugerir ingredientes exóticos ou inviáveis.
2. **A Regra Anti-Falha (Fricção Zero):** O desjejum e a refeição pré-treino devem ser extremamente práticas. Pessoas ocupadas falham na dieta quando a preparação demora mais de 15 minutos.
3. **Neuro-Performance:** Inclua fontes estratégicas de colina (ovos), ômega 3 e carboidratos de baixo índice glicêmico nos horários de trabalho focado do aluno para evitar o "crash" de energia e névoa mental.
4. **Alinhamento de Macros:**
   - Proteína: Mínimo de 1.8g a 2.2g por kg de peso corporal.
   - Gordura: 0.8g a 1.0g por kg.
   - Carboidratos: Preenchendo o resto das calorias (manipulados conforme o objetivo e horário do treino).
5. ⛔ **ALIMENTOS PROIBIDOS:** JAMAIS inclua alimentos que o aluno informou que não come, tem alergia, intolerância ou restrição. Se o aluno disse que NÃO COME um alimento, esse alimento NÃO PODE aparecer no plano em nenhuma refeição, nem como substituto. Revise CADA alimento contra as restrições antes de finalizar.
6. ⛔ **NÚMERO DE REFEIÇÕES:** RESPEITE o número de refeições informado pelo aluno. Se ele faz 3 refeições, gere EXATAMENTE 3. NÃO invente refeições extras.
7. **Preferências:** Respeite os horários e preferências de refeições do aluno.
8. Considere o estado mental (sono, estresse, humor) e nível de atividade para ajustar o plano.
9. **PORÇÕES:** Cada alimento DEVE ter a porção em MEDIDA CASEIRA + GRAMAS no formato "X [medida] ou Yg" (ex: "1 unidade ou 50g", "3 colheres de sopa cheias ou 45g", "2 fatias ou 60g"). NUNCA coloque apenas gramas.
10. **SUBSTITUTOS REAIS:** Cada alimento principal DEVE ter 1-3 substitutos nutricionalmente equivalentes. Substitutos devem ser alimentos DIFERENTES mas com macros similares.
11. Retorne a resposta ESTRITAMENTE no formato JSON com as chaves obrigatórias: 'title', 'goal', 'goal_description', 'meals' (cada meal com 'refeicoes'), 'macronutrientes' (totais diários), 'restricoes' (lista de restrições aplicadas).
${forbiddenSection}${mealCountRule}${mealScheduleInfo}

[EXEMPLO DE REFERÊNCIA - QUALIDADE ESPERADA]
Café da Manhã (08:00):
- Pão francês: 1 unidade (50g) → substitutos: Pão de forma 2 fatias (50g), Cuscuz de milho 1 pedaço grande (200g)
- Ovo de galinha: 3 unidades (150g) → substitutos: Frango desfiado 60g, Queijo mussarela 2 fatias (30g)

OBSERVE: porções sempre em medida caseira + gramas, substitutos práticos e equivalentes, alimentos 100% brasileiros.`;

    const userPrompt = `Gere um plano alimentar personalizado para este aluno:

## PERFIL DO ALUNO
- Nome: ${profile?.nome || "N/A"}
- Peso: ${profile?.peso || "N/A"} | Altura: ${profile?.altura || "N/A"} | Sexo: ${profile?.sexo || "N/A"}
- Gordura corporal: ${profile?.body_fat ? profile.body_fat + "%" : "N/A"}
- Meta de peso: ${profile?.meta_peso || "N/A"}
- GET estimado: ${estimatedCalories} kcal

## ANAMNESE
- Objetivo: ${anamnese?.objetivo || objetivoExtras || "N/A"}
- Dieta atual: ${anamnese?.dieta_atual || "N/A"}
- Restrições alimentares: ${anamnese?.restricoes_alimentares || "Nenhuma"}
- Suplementos: ${anamnese?.suplementos || "Nenhum"}
- Água diária: ${anamnese?.agua_diaria || "N/A"}
- Sono: ${anamnese?.sono_horas || horarioSono || "N/A"}
- Nível de estresse: ${anamnese?.nivel_estresse || "N/A"}
- Ocupação: ${anamnese?.ocupacao || "N/A"}
- Condições de saúde: ${anamnese?.condicoes_saude || "Nenhuma"}
- Medicamentos: ${anamnese?.medicamentos || "Nenhum"}
- Nível de atividade: ${nivelAtividade || "N/A"}

## PREFERÊNCIAS ALIMENTARES DO ALUNO
- Número de refeições por dia: ${refeicoesDia || "N/A"}
- Horários/preferências de refeições: ${horarioRefeicoes || "N/A"}
- Frutas preferidas: ${frutasPreferidas || "N/A"}
- Alimentos diários preferidos: ${alimentosDiarios || "N/A"}
- Investimento em dieta: ${investimentoDieta || "N/A"}
- Bebe líquido durante refeição: ${liquidoRefeicao || "N/A"} ${liquidoQual ? `(${liquidoQual})` : ""}

## ASSESSMENT MENSAL RECENTE
- Adesão dieta: ${assessment?.adesao_dieta || "N/A"}
- Restrição alimentar: ${assessment?.restricao_alimentar || "Nenhuma"}
- Alimentos proibidos: ${assessment?.alimentos_proibidos || "Nenhum"}
- Sugestão dieta: ${assessment?.sugestao_dieta || "N/A"}
- Refeições/horários: ${assessment?.refeicoes_horarios || "N/A"}
- Motivo não seguir dieta: ${assessment?.motivo_nao_dieta || "N/A"}

## ESTADO MENTAL (últimos 14 dias)
- Humor médio: ${avgMood}/5
- Estresse médio: ${avgStress}/5
- Sono médio: ${avgSleep}h

## HÁBITOS DIÁRIOS (últimos 14 dias)
- Água média: ${avgWater}L/dia
- Refeições completas média: ${avgMealsCompleted}/dia
- Constância (streak): ${streak} dias

## PERFORMANCE TREINOS
- Esforço médio (RPE): ${avgEffort}/10

## HISTÓRICO DE PLANOS ANTERIORES
${previousDiets.length > 0
  ? previousDiets.map(p => `- "${p.title}" | Objetivo: ${p.goal} | ${p.goal_description || "Sem descrição"} | Refeições: ${(p.meals as any[])?.length || 0}`).join("\n")
  : "Nenhum plano anterior"}

## OBJETIVO SELECIONADO: ${goal_type || "manutenção"}
${goal_hint ? `## INSTRUÇÃO ADICIONAL DO NUTRICIONISTA\n${goal_hint}` : ""}
${forbiddenFoods.length > 0 ? `\n## ⛔ LEMBRETE: NÃO INCLUA ESTES ALIMENTOS:\n${forbiddenFoods.map(f => `❌ ${f}`).join("\n")}` : ""}
${refeicoesDia ? `\n## 🔢 GERE EXATAMENTE ${refeicoesDia} REFEIÇÕES. NÃO MAIS.` : ""}

Gere o plano agora. Responda APENAS com o JSON válido.`;

    // =====================================================
    // Gemini API call with Structured Outputs (responseSchema)
    // =====================================================
    const responseSchema = {
      type: "OBJECT",
      properties: {
        title: { type: "STRING", description: "Nome do plano alimentar" },
        goal: { type: "STRING", enum: ["deficit", "bulking", "manutenção", "recomposição"], description: "Objetivo do plano" },
        goal_description: { type: "STRING", description: "Resumo estratégico de 2-3 linhas com distribuição de macros totais diários" },
        meals: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              name: { type: "STRING", description: "Nome da refeição (ex: Café da Manhã)" },
              time: { type: "STRING", description: "Horário no formato HH:MM" },
              foods: {
                type: "ARRAY",
                items: {
                  type: "OBJECT",
                  properties: {
                    name: { type: "STRING", description: "Nome do alimento" },
                    portion: { type: "STRING", description: "Medida caseira + gramas (ex: '1 unidade ou 50g')" },
                    calories: { type: "NUMBER", description: "Calorias do alimento" },
                    protein: { type: "NUMBER", description: "Proteína em gramas" },
                    carbs: { type: "NUMBER", description: "Carboidratos em gramas" },
                    fat: { type: "NUMBER", description: "Gordura em gramas" },
                    substitute: {
                      type: "OBJECT",
                      nullable: true,
                      properties: {
                        name: { type: "STRING" },
                        portion: { type: "STRING" },
                        calories: { type: "NUMBER" },
                        protein: { type: "NUMBER" },
                        carbs: { type: "NUMBER" },
                        fat: { type: "NUMBER" },
                      },
                      required: ["name", "portion", "calories", "protein", "carbs", "fat"],
                    },
                  },
                  required: ["name", "portion", "calories", "protein", "carbs", "fat"],
                },
              },
            },
            required: ["name", "time", "foods"],
          },
        },
        macronutrientes: {
          type: "OBJECT",
          description: "Totais diários de macronutrientes",
          properties: {
            calorias_totais: { type: "NUMBER", description: "Total de calorias diárias" },
            proteina_total_g: { type: "NUMBER", description: "Proteína total em gramas" },
            carboidratos_total_g: { type: "NUMBER", description: "Carboidratos totais em gramas" },
            gordura_total_g: { type: "NUMBER", description: "Gordura total em gramas" },
            proteina_por_kg: { type: "NUMBER", description: "Proteína por kg de peso corporal" },
            gordura_por_kg: { type: "NUMBER", description: "Gordura por kg de peso corporal" },
          },
          required: ["calorias_totais", "proteina_total_g", "carboidratos_total_g", "gordura_total_g"],
        },
        restricoes: {
          type: "ARRAY",
          items: { type: "STRING" },
          description: "Lista de restrições alimentares aplicadas neste plano",
        },
      },
      required: ["title", "goal", "goal_description", "meals", "macronutrientes", "restricoes"],
    };

    // Build the full prompt with RAG + RLHF context injected
    const fullUserPrompt = ragContext + rlhfContext + rlhfNegativeContext + "\n\n" + userPrompt;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: systemPrompt }],
          },
          contents: [
            { role: "user", parts: [{ text: fullUserPrompt }] },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 65536,
            responseMimeType: "application/json",
            responseSchema,
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

    if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
      console.error("Gemini blocked response:", JSON.stringify(candidate?.safetyRatings));
      throw new Error("A IA não conseguiu gerar o plano. Tente novamente com instruções diferentes.");
    }

    const rawText = candidate.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("Empty Gemini response. Full payload:", JSON.stringify(geminiData).slice(0, 500));
      throw new Error("Resposta vazia da IA. Tente novamente.");
    }

    // Parse JSON — with structured outputs this should always be valid
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
          console.error("No JSON object found. Raw (first 1000 chars):", rawText.slice(0, 1000));
          throw new Error("Falha ao interpretar resposta da IA. Tente novamente.");
        }
      }
    }

    // Log generation for RLHF
    try {
      await supabaseAdmin.from("ai_generation_logs").insert({
        specialist_id: specialistId,
        student_id: student_id,
        generated_content: planJson,
        prompt_context: `diet|${goal_type || "manutenção"}|RAG:${ragContext ? "yes" : "no"}`,
      });
    } catch (logErr) {
      console.warn("Failed to log AI generation:", logErr);
    }

    return new Response(JSON.stringify({ plan: planJson }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-diet-plan error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
