import { supabase } from "@/integrations/supabase/client";
import type { MonthlyFormData } from "@/pages/monthly-assessment/constants";

async function uploadPhoto(
  userId: string,
  file: File,
  label: string,
  folderId: string
): Promise<{ url: string | null; reason?: string }> {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `${userId}/monthly/${folderId}/${label}.${ext}`;
  const contentType = file.type || "image/jpeg";

  // Try upload with 1 retry — no compression, no validation, raw file.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.storage
      .from("anamnese-photos")
      .upload(path, file, { upsert: true, contentType });

    if (!error) {
      const { data } = supabase.storage.from("anamnese-photos").getPublicUrl(path);
      return { url: data.publicUrl };
    }

    console.error(`Erro upload ${label} (tentativa ${attempt + 1}):`, error);
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500));
    }
  }

  return { url: null, reason: "falha de conexão com o servidor" };
}

export async function submitMonthlyAssessment(
  formData: MonthlyFormData
): Promise<{ success: boolean; error?: string; warning?: string }> {
  try {
    await supabase.auth.refreshSession();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Sessão expirada. Faça login novamente e tente outra vez." };

    const folderId = (typeof crypto !== "undefined" && crypto.randomUUID)
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const photoFields: { key: keyof MonthlyFormData; label: string; column: string }[] = [
      { key: "foto_frente", label: "frente", column: "foto_frente" },
      { key: "foto_costas", label: "costas", column: "foto_costas" },
      { key: "foto_lado_direito", label: "lado_direito", column: "foto_lado_direito" },
      { key: "foto_lado_esquerdo", label: "lado_esquerdo", column: "foto_lado_esquerdo" },
      { key: "foto_perfil_lado", label: "perfil_lado", column: "foto_perfil_lado" },
    ];

    const photoUpdates: Record<string, string> = {};
    const failedDetails: Array<{ label: string; reason: string }> = [];
    const photosToUpload = photoFields.filter(({ key }) => formData[key] instanceof File);

    const uploads = photosToUpload.map(async ({ key, label, column }) => {
      const result = await uploadPhoto(user.id, formData[key] as File, label, folderId);
      if (result.url) {
        photoUpdates[column] = result.url;
        console.log(`[submitMonthlyAssessment] Photo uploaded: ${column} → ${result.url}`);
      } else {
        failedDetails.push({ label, reason: result.reason || "erro desconhecido" });
      }
    });

    await Promise.all(uploads);

    if (photosToUpload.length > 0 && Object.keys(photoUpdates).length === 0) {
      console.error("[submitMonthlyAssessment] ALL photo uploads failed", failedDetails);
      throw new Error(
        failedDetails[0]?.reason
        || "Nenhuma foto foi enviada com sucesso. Verifique sua conexão e tente novamente."
      );
    }

    if (failedDetails.length > 0) {
      console.warn(`[submitMonthlyAssessment] Some photos failed:`, failedDetails);
    }

    await supabase.auth.refreshSession();

    const insertPayload: Record<string, any> = {
      user_id: user.id,
      altura: formData.altura || null,
      peso: formData.peso || null,
      modalidade: formData.modalidade || null,
      nivel_fadiga: formData.nivel_fadiga ? parseInt(formData.nivel_fadiga) : null,
      progresso_peitoral: formData.progresso_peitoral === "sim" ? true : formData.progresso_peitoral === "nao" ? false : null,
      progresso_costas: formData.progresso_costas === "sim" ? true : formData.progresso_costas === "nao" ? false : null,
      progresso_deltoide: formData.progresso_deltoide === "sim" ? true : formData.progresso_deltoide === "nao" ? false : null,
      progresso_triceps: formData.progresso_triceps === "sim" ? true : formData.progresso_triceps === "nao" ? false : null,
      progresso_biceps: formData.progresso_biceps === "sim" ? true : formData.progresso_biceps === "nao" ? false : null,
      progresso_quadriceps: formData.progresso_quadriceps === "sim" ? true : formData.progresso_quadriceps === "nao" ? false : null,
      progresso_posteriores: formData.progresso_posteriores === "sim" ? true : formData.progresso_posteriores === "nao" ? false : null,
      progresso_gluteos: formData.progresso_gluteos === "sim" ? true : formData.progresso_gluteos === "nao" ? false : null,
      progresso_panturrilha: formData.progresso_panturrilha === "sim" ? true : formData.progresso_panturrilha === "nao" ? false : null,
      progresso_abdomen: formData.progresso_abdomen || null,
      progresso_antebraco: formData.progresso_antebraco || null,
      notas_progressao: formData.notas_progressao || null,
      prioridades_fisicas: formData.prioridades_fisicas || null,
      dias_disponiveis: formData.dias_disponiveis.length > 0 ? formData.dias_disponiveis : null,
      frequencia_compromisso: formData.frequencia_compromisso || null,
      tempo_disponivel: formData.tempo_disponivel || null,
      maquinas_indisponiveis: formData.maquinas_indisponiveis.length > 0 ? formData.maquinas_indisponiveis : null,
      adesao_treinos: formData.adesao_treinos ? parseInt(formData.adesao_treinos) : null,
      motivo_adesao_treinos: formData.motivo_adesao_treinos || null,
      adesao_cardios: formData.adesao_cardios ? parseInt(formData.adesao_cardios) : null,
      motivo_adesao_cardios: formData.motivo_adesao_cardios || null,
      alongamentos_corretos: formData.alongamentos_corretos === "sim" ? true : formData.alongamentos_corretos === "nao" ? false : null,
      refeicoes_horarios: formData.refeicoes_horarios === "outro" ? formData.refeicoes_horarios_outro : formData.refeicoes_horarios || null,
      horario_treino: formData.horario_treino === "outro" ? formData.horario_treino_outro : formData.horario_treino || null,
      horario_treino_outro: formData.horario_treino === "outro" ? formData.horario_treino_outro : null,
      objetivo_atual: formData.objetivo_atual || null,
      competicao_fisiculturismo: formData.competicao_fisiculturismo || null,
      restricao_alimentar: formData.restricao_alimentar || null,
      alimentos_proibidos: formData.alimentos_proibidos || null,
      adesao_dieta: formData.adesao_dieta || null,
      motivo_nao_dieta: formData.motivo_nao_dieta || null,
      sugestao_dieta: formData.sugestao_dieta || null,
      autoriza_publicacao: formData.autoriza_publicacao === "sim",
      sugestao_melhoria: formData.sugestao_melhoria || null,
      ...photoUpdates,
    };

    console.log("[submitMonthlyAssessment] Inserting assessment with photos:", {
      userId: user.id,
      photoColumns: Object.keys(photoUpdates),
    });

    const { data: assessment, error: insertError } = await supabase
      .from("monthly_assessments")
      .insert(insertPayload as any)
      .select("id")
      .single();

    if (insertError || !assessment) {
      console.error("[submitMonthlyAssessment] INSERT FAILED:", insertError);
      throw new Error(`Erro ao salvar reavaliação: ${insertError?.message || "Sem ID retornado"}`);
    }

    const assessmentId = (assessment as any).id as string;
    console.log("[submitMonthlyAssessment] Assessment saved successfully:", assessmentId);

    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("type", "anamnese_request")
      .eq("read", false);

    const nextDue = new Date();
    nextDue.setDate(nextDue.getDate() + 30);
    await supabase
      .from("profiles")
      .update({ next_anamnese_due: nextDue.toISOString().split("T")[0] })
      .eq("id", user.id);

    await supabase
      .from("profiles")
      .update({
        peso: formData.peso || undefined,
        altura: formData.altura || undefined,
      })
      .eq("id", user.id);

    try {
      const { data: studentProfile } = await supabase
        .from("profiles")
        .select("nome")
        .eq("id", user.id)
        .maybeSingle();

      const { data: specialists } = await supabase
        .from("student_specialists")
        .select("specialist_id")
        .eq("student_id", user.id);

      if (specialists && specialists.length > 0) {
        const studentName = studentProfile?.nome || "Aluno";
        const notifications = specialists.map((s) => ({
          user_id: s.specialist_id,
          title: "📝 Nova Reavaliação Mensal",
          body: `${studentName} enviou a reavaliação mensal.`,
          type: "monthly_completed",
          metadata: { student_id: user.id, assessment_id: assessmentId },
        }));
        await supabase.from("notifications").insert(notifications as any);
      }
    } catch (notifError) {
      console.error("Erro ao notificar especialistas:", notifError);
    }

    try {
      const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbzFzk3QLHv8oxt-1xLKxILb0pmirT24Y4OxhLw3uKm1o-GR5q38sLxZVbco9raf_vmx/exec";
      const sheetData: Record<string, any> = {};
      for (const [key, value] of Object.entries(formData)) {
        if (value instanceof File) continue;
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
          sheetData[key] = value.join(", ");
        } else {
          sheetData[key] = value;
        }
      }
      sheetData["data_envio"] = new Date().toISOString();
      for (const [key, url] of Object.entries(photoUpdates)) {
        sheetData[key] = url;
      }

      fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(sheetData),
      }).catch((err) => console.error("Erro ao enviar reavaliação para planilha:", err));
    } catch (sheetError) {
      console.error("Erro ao preparar dados para planilha:", sheetError);
    }

    // Clear any snoozed/dismissed monthly assessment alerts so specialists see the fresh submission
    try {
      await supabase
        .from("dismissed_alerts" as any)
        .delete()
        .eq("student_id", user.id)
        .in("alert_key", [
          `monthly-pending-${user.id}`,
          `monthly-review-${user.id}`,
          `assessment-never-${user.id}`,
        ]);
    } catch (cleanupErr) {
      console.error("Erro ao limpar avisos suspensos:", cleanupErr);
    }

    const warning = failedDetails.length > 0
      ? `Algumas fotos não foram enviadas (${failedDetails.map((f) => f.label).join(", ")}).`
      : undefined;
    return { success: true, warning };
  } catch (error: any) {
    console.error("Erro ao salvar reavaliação:", error);
    return { success: false, error: error.message || "Erro desconhecido. Verifique sua conexão e tente novamente." };
  }
}
