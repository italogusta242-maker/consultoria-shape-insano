import { supabase } from "@/integrations/supabase/client";
import type { MonthlyFormData } from "@/pages/monthly-assessment/constants";

const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.85;

/** Heuristic check: did the canvas actually receive pixel data, or is it
 *  filled with a single color (the classic "all-black" symptom that happens
 *  when the browser can't decode HEIC/HEIF and silently fires onload anyway)? */
function canvasHasRealContent(ctx: CanvasRenderingContext2D, width: number, height: number): boolean {
  try {
    // Sample a 32x32 grid of pixels — fast and reliable.
    const samples = 32;
    const stepX = Math.max(1, Math.floor(width / samples));
    const stepY = Math.max(1, Math.floor(height / samples));
    const data = ctx.getImageData(0, 0, width, height).data;
    let firstR = -1, firstG = -1, firstB = -1;
    let varied = false;
    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const i = (y * width + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (firstR === -1) { firstR = r; firstG = g; firstB = b; continue; }
        if (Math.abs(r - firstR) > 4 || Math.abs(g - firstG) > 4 || Math.abs(b - firstB) > 4) {
          varied = true;
          break;
        }
      }
      if (varied) break;
    }
    return varied;
  } catch {
    // getImageData can fail on tainted canvases; assume content is OK.
    return true;
  }
}

function compressImage(file: File): Promise<File> {
  const isHeic = /\.(heic|heif)$/i.test(file.name) || /heic|heif/i.test(file.type);
  const needsConversion = isHeic || !file.type || !file.type.startsWith("image/jpeg");

  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;

      // 1) Browser couldn't even decode dimensions → HEIC failure on Android/Chrome.
      if (!width || !height) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(
          `Não foi possível ler a foto "${file.name}". ` +
          `Se a foto foi tirada em iPhone, ative no app Câmera: Ajustes → Câmera → Formatos → "Mais Compatível" (JPEG). ` +
          `Ou converta a imagem para JPG/PNG antes de enviar.`
        ));
        return;
      }

      const needsResize = width > MAX_IMAGE_DIM || height > MAX_IMAGE_DIM;
      if (needsResize) {
        const ratio = Math.min(MAX_IMAGE_DIM / width, MAX_IMAGE_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      // Paint a non-black background first so a true blank canvas would show as white,
      // not as a "valid" black photo.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      // 2) Detect the silent-decode-failure case → canvas has only one color.
      if (!canvasHasRealContent(ctx, width, height)) {
        URL.revokeObjectURL(objectUrl);
        reject(new Error(
          `A foto "${file.name}" não pôde ser processada (provavelmente formato HEIC do iPhone). ` +
          `Ative em Ajustes → Câmera → Formatos → "Mais Compatível", ou envie a foto em JPG/PNG.`
        ));
        return;
      }

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl);
          if (blob && blob.size > 1024) {
            resolve(new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            reject(new Error(`Falha ao comprimir "${file.name}". Tente uma foto menor ou outro formato.`));
          }
        },
        "image/jpeg",
        JPEG_QUALITY
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(
        `Não foi possível abrir "${file.name}". ` +
        `Verifique se é uma imagem JPG, PNG ou WebP válida (HEIC do iPhone pode falhar em alguns dispositivos).`
      ));
    };
    img.src = objectUrl;
  });
}

async function uploadPhoto(
  userId: string,
  file: File,
  label: string,
  folderId: string
): Promise<{ url: string | null; reason?: string }> {
  // Compress before upload — may throw with a user-friendly message (HEIC etc.)
  let compressed: File;
  try {
    compressed = await compressImage(file);
  } catch (err: any) {
    const reason = err?.message || "falha ao processar a imagem";
    console.error(`[uploadPhoto] compressão falhou para ${label}:`, reason);
    return { url: null, reason };
  }

  const ext = compressed.name.split(".").pop() || "jpg";
  const path = `${userId}/monthly/${folderId}/${label}.${ext}`;

  // Try upload with 1 retry
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.storage
      .from("anamnese-photos")
      .upload(path, compressed, { upsert: true, contentType: compressed.type || "image/jpeg" });

    if (!error) {
      const { data } = supabase.storage.from("anamnese-photos").getPublicUrl(path);
      return { url: data.publicUrl };
    }

    console.error(`Erro upload ${label} (tentativa ${attempt + 1}):`, error);
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, 1500)); // wait before retry
    }
  }

  return { url: null, reason: "falha de conexão com o servidor" };
}

export async function submitMonthlyAssessment(
  formData: MonthlyFormData
): Promise<{ success: boolean; error?: string; warning?: string }> {
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

    // Abort if user provided photos but ALL failed — return the most informative reason.
    if (photosToUpload.length > 0 && Object.keys(photoUpdates).length === 0) {
      console.error("[submitMonthlyAssessment] ALL photo uploads failed", failedDetails);
      const heicReason = failedDetails.find((f) => /HEIC|iPhone|Compatível/i.test(f.reason));
      const message = heicReason?.reason
        || failedDetails[0]?.reason
        || "Nenhuma foto foi enviada com sucesso. Verifique sua conexão e tente novamente.";
      throw new Error(message);
    }

    if (failedDetails.length > 0) {
      console.warn(`[submitMonthlyAssessment] Some photos failed:`, failedDetails);
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

    const warning = failedDetails.length > 0
      ? `Algumas fotos não foram enviadas (${failedDetails.map((f) => f.label).join(", ")}). Motivo: ${failedDetails[0].reason}`
      : undefined;
    return { success: true, warning };
  } catch (error: any) {
    console.error("Erro ao salvar reavaliação:", error);
    return { success: false, error: error.message || "Erro desconhecido. Verifique sua conexão e tente novamente." };
  }
}
