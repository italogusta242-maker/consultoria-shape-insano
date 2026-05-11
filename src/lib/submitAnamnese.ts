import type { UserData } from "@/pages/onboarding/constants";
import { supabase } from "@/integrations/supabase/client";

const MAX_IMAGE_DIM = 1200;
const JPEG_QUALITY = 0.8;

function compressImage(file: File): Promise<File> {
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
      resolve(file);
    };
    img.src = URL.createObjectURL(file);
  });
}

async function uploadPhoto(
  userId: string,
  file: File,
  label: string,
  anamneseId: string
): Promise<string | null> {
  const compressed = await compressImage(file);
  const ext = compressed.name.split(".").pop() || "jpg";
  const path = `${userId}/${anamneseId}/${label}.${ext}`;

  const { error } = await supabase.storage
    .from("anamnese-photos")
    .upload(path, compressed, { upsert: true, contentType: compressed.type || "image/jpeg" });

  if (error) {
    console.error(`Erro upload ${label}:`, error);
    return null;
  }

  const { data } = supabase.storage
    .from("anamnese-photos")
    .getPublicUrl(path);

  return data.publicUrl;
}

export async function submitAnamnese(
  userData: UserData,
  resultClass: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "Usuário não autenticado" };

    // 1. Update profile with onboarding data
    const { error: profileError } = await supabase
      .from("profiles")
      .update({
        nome: userData.nome,
        email: userData.email,
        telefone: userData.telefone,
        nascimento: userData.nascimento,
        cpf: userData.cpf,
        cidade_estado: userData.cidade_estado,
        sexo: userData.sexo,
        altura: userData.altura,
        peso: userData.peso,
        tempo_acompanha: userData.tempo_acompanha,
        fatores_escolha: userData.fatores_escolha,
        indicacao: userData.indicacao,
        indicacao_nome: userData.indicacao_nome,
        indicacao_telefone: userData.indicacao_telefone,
        cep: userData.cep || null,
        logradouro: userData.logradouro || null,
        bairro: userData.bairro || null,
        meta_peso: userData.meta_peso || null,
        como_chegou: userData.como_chegou || null,
        onboarded: true,
      })
      .eq("id", user.id);

    if (profileError) throw profileError;

    // 2. Build dados_extras (skip profile fields and files)
    const dadosExtras: Record<string, any> = {};
    const skipKeys = new Set([
      "nome", "email", "telefone", "nascimento", "cpf", "cidade_estado",
      "sexo", "altura", "peso", "tempo_acompanha",
      "fatores_escolha", "indicacao", "indicacao_nome", "indicacao_telefone",
      "cep", "logradouro", "bairro", "meta_peso", "como_chegou",
    ]);

    for (const [key, value] of Object.entries(userData)) {
      if (skipKeys.has(key)) continue;
      if (value === null || value === undefined || value === "") continue;
      if (value instanceof File) continue;
      dadosExtras[key] = value;
    }

    // 3. Insert anamnese first to get the ID
    const medicamentosStr = Array.isArray(userData.medicamentos)
      ? userData.medicamentos.join(", ")
      : userData.medicamentos;

    const { data: anamneseData, error: anamneseError } = await supabase
      .from("anamnese")
      .insert({
        user_id: user.id,
        objetivo: userData.objetivo || userData.objetivo_outro || null,
        local_treino: userData.local_treino || null,
        frequencia_treino: userData.frequencia || null,
        experiencia_treino: userData.pratica_musculacao || null,
        equipamentos: userData.maquinas_casa || null,
        lesoes: userData.tem_dor === "sim" ? userData.descricao_dor : null,
        condicoes_saude: userData.doencas?.join(", ") || null,
        medicamentos: medicamentosStr || null,
        restricoes_alimentares: userData.restricoes?.join(", ") || null,
        dieta_atual: userData.calorias || null,
        suplementos: userData.suplementos?.join(", ") || null,
        agua_diaria: userData.agua || null,
        sono_horas: userData.horario_sono || null,
        nivel_estresse: userData.qualidade_sono || null,
        ocupacao: null,
        disponibilidade_treino: userData.dias_semana?.join(", ") || null,
        motivacao: userData.fatores_escolha || null,
        dados_extras: dadosExtras,
      })
      .select("id")
      .single();

    if (anamneseError) throw anamneseError;

    // 4. Upload photos and save URLs
    const photoFields: { key: keyof UserData; label: string }[] = [
      { key: "foto_frente", label: "frente" },
      { key: "foto_costas", label: "costas" },
      { key: "foto_direito", label: "direito" },
      { key: "foto_esquerdo", label: "esquerdo" },
      { key: "foto_perfil", label: "perfil" },
      { key: "foto_pose_frente", label: "pose_frente" },
      { key: "foto_pose_lado", label: "pose_lado" },
      { key: "foto_pose_costas", label: "pose_costas" },
    ];

    const photoUrls: Record<string, string> = {};
    const uploads = photoFields
      .filter(({ key }) => userData[key] instanceof File)
      .map(async ({ key, label }) => {
        const url = await uploadPhoto(user.id, userData[key] as File, label, anamneseData.id);
        if (url) photoUrls[label] = url;
      });

    await Promise.all(uploads);

    // 4b. Upload blood test PDF if provided
    let exameUrl: string | null = null;
    if (userData.exame_sangue instanceof File) {
      const ext = userData.exame_sangue.name.split(".").pop() || "pdf";
      const path = `${user.id}/${anamneseData.id}/exame_sangue.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from("exames-sangue")
        .upload(path, userData.exame_sangue, { upsert: true });
      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("exames-sangue").getPublicUrl(path);
        exameUrl = urlData.publicUrl;
      } else {
        console.error("Erro upload exame:", uploadErr);
      }
    }

    // 5. Update anamnese with photo URLs and exame in dados_extras
    const hasExtras = Object.keys(photoUrls).length > 0 || exameUrl;
    if (hasExtras) {
      const updatedExtras = { 
        ...dadosExtras, 
        fotos: photoUrls,
        ...(exameUrl ? { exame_sangue_url: exameUrl } : {}),
      };
      await supabase
        .from("anamnese")
        .update({ dados_extras: updatedExtras })
        .eq("id", anamneseData.id);
    }

    // 6. Send data to Google Sheets
    try {
      const WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbxy2VcEx_Yntb9y7kQKR_CYuLpDLOuDPqsGZEbdK7mnGPsjdTv3NgFY7chAq2G7rs7ifw/exec";
      const sheetData: Record<string, any> = {};
      for (const [key, value] of Object.entries(userData)) {
        if (value instanceof File) continue;
        if (value === null || value === undefined) continue;
        if (Array.isArray(value)) {
          sheetData[key] = value.join(", ");
        } else {
          sheetData[key] = value;
        }
      }
      sheetData["data_envio"] = new Date().toISOString();
      sheetData["classificacao"] = resultClass;

      fetch(WEBHOOK_URL, {
        method: "POST",
        body: JSON.stringify(sheetData),
      }).catch((err) => console.error("Erro ao enviar para planilha:", err));
    } catch (sheetError) {
      console.error("Erro ao preparar dados para planilha:", sheetError);
    }

    // 7. Notify linked specialists about completed anamnese
    try {
      const { data: specialists } = await supabase
        .from("student_specialists")
        .select("specialist_id")
        .eq("student_id", user.id);

      if (specialists && specialists.length > 0) {
        const studentName = userData.nome || "Aluno";
        const notifications = specialists.map((s) => ({
          user_id: s.specialist_id,
          title: "📋 Nova anamnese preenchida",
          body: `${studentName} finalizou o preenchimento da anamnese.`,
          type: "anamnese_submitted",
          metadata: { student_id: user.id },
        }));
        await supabase.from("notifications").insert(notifications as any);
      }
    } catch (notifErr) {
      console.error("Erro ao notificar especialistas:", notifErr);
    }

    // 8. Clear any snoozed/dismissed anamnesis alerts so specialists see the fresh submission
    try {
      await supabase
        .from("dismissed_alerts" as any)
        .delete()
        .eq("student_id", user.id)
        .in("alert_key", [
          `anamnese-review-${user.id}`,
          `monthly-pending-${user.id}`,
          `monthly-review-${user.id}`,
          `assessment-never-${user.id}`,
        ]);
    } catch (cleanupErr) {
      console.error("Erro ao limpar avisos suspensos:", cleanupErr);
    }

    return { success: true };
  } catch (error: any) {
    console.error("Erro ao salvar anamnese:", error);
    return {
      success: false,
      error: error.message || "Erro desconhecido",
    };
  }
}
