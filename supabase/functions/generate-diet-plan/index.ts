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
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

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

    const systemPrompt = `[IDENTITY & PURPOSE]
Você é a inteligência artificial nutricional de elite do ecossistema Shape Insano Pro. Seu objetivo não é apenas calcular macros, mas desenhar estratégias nutricionais focadas em neuro-performance, altíssima adesão e resultados estéticos. Você atua como o braço direito do Nutricionista Chefe. O seu plano deve blindar o aluno contra a desistência e manter a "Chama de Honra" (nossa métrica de constância) sempre acesa.

${specialistStyle}

[STRICT RULES OF ENGAGEMENT]

1. **Realismo Brasileiro (Base TACO/TBCA):** Utilize APENAS alimentos acessíveis e comuns no Brasil (ex: arroz, feijão, ovo de galinha, pão francês, frango, patinho, cuscuz, tapioca). Proibido sugerir ingredientes exóticos ou inviáveis (como mirtilos frescos diários ou salmão selvagem), a menos que o aluno tenha altíssimo poder aquisitivo explícito no perfil.
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
10. **SUBSTITUTOS REAIS:** Cada alimento principal DEVE ter 1-3 substitutos nutricionalmente equivalentes. Substitutos devem ser alimentos DIFERENTES mas com macros similares (ex: arroz → batata inglesa, frango → tilápia, feijão carioca → feijão preto).
11. Retorne APENAS o JSON válido no formato especificado.
${forbiddenSection}${mealCountRule}${mealScheduleInfo}

[EXEMPLO DE REFERÊNCIA - QUALIDADE ESPERADA]
Este é um exemplo REAL de plano aprovado por nutricionista. USE como referência de QUALIDADE, nível de detalhe e formato de porções:

Café da Manhã (08:00):
- Pão francês: 1 unidade (50g) → substitutos: Pão de forma 2 fatias (50g), Cuscuz de milho 1 pedaço grande (200g), Tapioca 3 colheres de sopa rasas (45g)
- Ovo de galinha: 3 unidades (150g) → substitutos: Frango desfiado 60g, Queijo mussarela 2 fatias (30g)
- Iogurte natural: 1 unidade (100g)
- Fruta de preferência: 1 unidade grande (100g)

Almoço:
- Arroz branco: 4 colheres de arroz cheias (180g) → substitutos: Batata inglesa 9 col sopa (217g), Mandioca 5 col sopa (176g)
- Feijão carioca: 2 conchas rasas (160g) → substitutos: Feijão preto 2 conchas rasas (160g), Grão de bico 2 conchas rasas (160g)
- Filé de frango grelhado: 1 fatia média (110g) → substitutos: Carne (alcatra, patinho) grelhada 1 fatia (110g), Tilápia 1 unidade (113g)
- Verduras: 3 colheres de servir cheias (120g)
- Salada: À vontade

OBSERVE: porções sempre em medida caseira + gramas, substitutos práticos e equivalentes, alimentos 100% brasileiros.

[OUTPUT FORMAT]
Retorne um JSON com esta estrutura EXATA:
{
  "title": "Nome do Plano",
  "goal": "deficit|bulking|manutenção|recomposição",
  "goal_description": "Resumo estratégico: 2-3 linhas explicando POR QUE essa dieta vai funcionar para a rotina específica deste aluno. Inclua distribuição de macros totais diários (ex: Proteína Xg | Carbs Yg | Gordura Zg | Total Wkcal).",
  "meals": [
    {
      "name": "Nome da Refeição",
      "time": "HH:MM",
      "foods": [
        {
          "name": "Nome do alimento",
          "portion": "medida caseira ou Xg",
          "calories": 150,
          "protein": 10,
          "carbs": 20,
          "fat": 5,
          "substitute": {
            "name": "Substituto equivalente",
            "portion": "medida caseira ou Xg",
            "calories": 145,
            "protein": 9,
            "carbs": 21,
            "fat": 4
          }
        }
      ]
    }
  ]
}

IMPORTANTE sobre o formato:
- "portion" deve ser string com medida caseira + gramas: "1 unidade ou 50g", "3 colheres de sopa cheias ou 45g"
- "substitute" é um OBJETO ÚNICO (não array) com o substituto mais relevante, ou null se não houver
- Macros são números (não strings)
- NÃO inclua campos extras como "quantity", "unit", "macros", "notes" nas refeições`;

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

    // Call Gemini API
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt + "\n\n" + userPrompt }] },
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

    if (!candidate || candidate.finishReason === "SAFETY" || candidate.finishReason === "RECITATION") {
      console.error("Gemini blocked response:", JSON.stringify(candidate?.safetyRatings));
      throw new Error("A IA não conseguiu gerar o plano. Tente novamente com instruções diferentes.");
    }

    const rawText = candidate.content?.parts?.[0]?.text;
    if (!rawText) {
      console.error("Empty Gemini response. Full payload:", JSON.stringify(geminiData).slice(0, 500));
      throw new Error("Resposta vazia da IA. Tente novamente.");
    }

    // Parse JSON with multiple strategies
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
