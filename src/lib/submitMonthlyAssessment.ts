import { supabase } from "@/integrations/supabase/client";
import type { MonthlyFormData } from "@/pages/monthly-assessment/constants";

const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.8;

function compressImage(file: File): Promise<File> {
  // Always convert through canvas to ensure JPEG output (handles HEIC, WEBP, etc.)
  const needsConversion = !file.type || !file.type.startsWith("image/jpeg");
  
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      const needsResize = width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM;
      
      if (!needsResize && !needsConversion) {
        URL.revokeObjectURL(img.src);
        resolve(file);
        return;
      }
      
      if (needsResize) {
        const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }
      
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(img.src);
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      resolve(file); // fallback to original
    };
    img.src = URL.createObjectURL(file);
  });
}

async function uploadPhoto(
  userId: string,
  file: File,
  label: string,
  folderId: string
): Promise<string | null> {
  // Compress before upload
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop() || "jpg";
  const path = `${userId}/monthly/${folderId}/${label}.${ext}`;

  // Try upload with 1 retry
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.storage
      .from("anamnese-photos")
      .upload(path, compressed, { upsert: true, contentType: compressed.type || "image/jpeg" });

    if (!error) {
      const { data } = supabase.storage.from("anamnese-photos").getPublicUrl(path);
      return data.publicUrl;
    }

    console.error(`Erro upload ${label} (tentativa ${attempt + 1}):`, error);
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500)); // wait before retry
    }
  }

  return null;
}

export async function submitMonthlyAssessment(
  formData: MonthlyFormData
): Promise<{ success: boolean; error?: string }> {
  try {
    // Refresh session to avoid expired token issues
    await supabase.auth.refreshSession();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Sessão expirada. Faça login novamente e tente outra vez." };

    // 1. Upload photos FIRST (before INSERT) — guarantees URLs are saved with the row
    // Generate a temporary folder id since we don't have assessment id yet
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
    const photosToUpload = photoFields.filter(({ key }) => formData[key] instanceof File);

    const uploads = photosToUpload.map(async ({ key, label, column }) => {
      const url = await uploadPhoto(user.id, formData[key] as File, label, folderId);
      if (url) {
        photoUpdates[column] = url;
        console.log(`[submitMonthlyAssessment] Photo uploaded: ${column} → ${url}`);
      }
    });

    await Promise.all(uploads);

    // Abort if user provided photos but ALL failed
    if (photosToUpload.length > 0 && Object.keys(photoUpdates).length === 0) {
      console.error("[submitMonthlyAssessment] ALL photo uploads failed");
      throw new Error("Nenhuma foto foi enviada com sucesso. Verifique sua conexão e tente novamente.");
    }

    // 2. Refresh session AGAIN right before INSERT (in case uploads took long)
    await supabase.auth.refreshSession();

    // 3. Build full payload INCLUDING photo URLs and INSERT once
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
      // PHOTO URLs included directly in INSERT (atomic) ↓
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

    // 4. Mark notifications as read and update next_anamnese_due
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

    // 5. Update profile weight/height
    await supabase
      .from("profiles")
      .update({
        peso: formData.peso || undefined,
        altura: formData.altura || undefined,
      })
      .eq("id", user.id);

    // 6. Notify specialists
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

    // 7. Send data to Google Sheets
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

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao salvar reavaliação:", error);
    return { success: false, error: error.message || "Erro desconhecido. Verifique sua conexão e tente novamente." };
  }
}
