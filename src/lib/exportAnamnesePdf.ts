/**
 * @purpose Generate a professional, vector-based PDF of an athlete's anamnese.
 *          Text is selectable & searchable (not a screenshot).
 * @dependencies jspdf, jspdf-autotable
 */
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

interface AnamneseLike {
  created_at?: string;
  dados_extras?: Record<string, any> | null;
  // Legacy direct columns (fallback)
  objetivo?: string | null;
  local_treino?: string | null;
  frequencia_treino?: string | null;
  experiencia_treino?: string | null;
  motivacao?: string | null;
  disponibilidade_treino?: string | null;
  lesoes?: string | null;
  equipamentos?: string | null;
  condicoes_saude?: string | null;
  medicamentos?: string | null;
  restricoes_alimentares?: string | null;
  suplementos?: string | null;
  dieta_atual?: string | null;
  sono_horas?: string | null;
  nivel_estresse?: string | null;
  agua_diaria?: string | null;
  ocupacao?: string | null;
}

interface ProfileLike {
  nome?: string | null;
  nascimento?: string | null;
  sexo?: string | null;
  peso?: string | null;
  altura?: string | null;
  meta_peso?: string | null;
  body_fat?: number | null;
  email?: string | null;
  telefone?: string | null;
  cpf?: string | null;
  cidade_estado?: string | null;
}

interface MonthlyPhotos {
  foto_frente?: string | null;
  foto_costas?: string | null;
  foto_lado_direito?: string | null;
  foto_lado_esquerdo?: string | null;
  foto_perfil_lado?: string | null;
  created_at?: string;
}

interface ExportPayload {
  profile: ProfileLike | null;
  anamnese: AnamneseLike | null;
  latestMonthly?: MonthlyPhotos | null;
  specialistName?: string;
}

const GOLD: [number, number, number] = [212, 175, 55];
const DARK: [number, number, number] = [30, 30, 32];
const MUTED: [number, number, number] = [120, 120, 125];

function val(extras: Record<string, any>, key: string, fallback?: string | null): string {
  const v = extras[key];
  if (v != null && v !== "") {
    if (Array.isArray(v)) return v.join(", ") || "—";
    return String(v);
  }
  if (fallback != null && fallback !== "") return String(fallback);
  return "—";
}

function valWithOther(extras: Record<string, any>, mainKey: string, otherKey: string, fallback?: string | null): string {
  const main = val(extras, mainKey, fallback);
  const other = extras[otherKey];
  const otherStr = other != null && other !== "" ? String(other) : "";
  if (main !== "—" && otherStr) {
    if (/^(outr[oa]s?|sim)$/i.test(main.trim())) return otherStr;
    return `${main}: ${otherStr}`;
  }
  if (main === "—" && otherStr) return otherStr;
  return main;
}

function calcAge(nascimento?: string | null): string {
  if (!nascimento) return "—";
  const parts = nascimento.includes("/") ? nascimento.split("/") : nascimento.split("-");
  if (parts.length !== 3) return "—";
  let day: number, month: number, year: number;
  if (nascimento.includes("/")) {
    [day, month, year] = parts.map(Number);
  } else {
    [year, month, day] = parts.map(Number);
  }
  const birth = new Date(year, month - 1, day);
  if (isNaN(birth.getTime())) return "—";
  const diff = Date.now() - birth.getTime();
  return String(Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25)));
}

function calcIMC(peso?: string | null, altura?: string | null): string {
  if (!peso || !altura) return "—";
  const p = parseFloat(peso.replace(",", "."));
  let a = parseFloat(altura.replace(",", "."));
  if (a > 3) a = a / 100;
  if (isNaN(p) || isNaN(a) || a === 0) return "—";
  return (p / (a * a)).toFixed(1);
}

async function urlToImageData(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    const reader = new FileReader();
    const dataUrl: string = await new Promise((resolve, reject) => {
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    // Get dimensions
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    if (dims.w === 0 || dims.h === 0) return null;
    return { data: dataUrl, w: dims.w, h: dims.h };
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, profile: ProfileLike | null, specialistName?: string) {
  const pageW = doc.internal.pageSize.getWidth();
  // Top gold bar
  doc.setFillColor(...GOLD);
  doc.rect(0, 0, pageW, 8, "F");

  doc.setFontSize(20);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text("ANAMNESE COMPLETA", 14, 22);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED);
  doc.text("Shape Insano · Documento técnico-clínico", 14, 28);

  doc.setFontSize(9);
  const dateStr = new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
  const exportLine = `Exportado em: ${dateStr}`;
  doc.text(exportLine, pageW - 14, 22, { align: "right" });
  if (specialistName) {
    doc.text(`Por: ${specialistName}`, pageW - 14, 28, { align: "right" });
  }

  // Athlete name
  doc.setFontSize(14);
  doc.setTextColor(...DARK);
  doc.setFont("helvetica", "bold");
  doc.text(`Atleta: ${profile?.nome || "—"}`, 14, 40);

  doc.setLineWidth(0.5);
  doc.setDrawColor(...GOLD);
  doc.line(14, 43, pageW - 14, 43);
}

function drawFooter(doc: jsPDF) {
  const pageH = doc.internal.pageSize.getHeight();
  const pageW = doc.internal.pageSize.getWidth();
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Shape Insano · Anamnese gerada automaticamente", 14, pageH - 8);
    doc.text(`Página ${i} de ${totalPages}`, pageW - 14, pageH - 8, { align: "right" });
  }
}

function section(doc: jsPDF, title: string, rows: [string, string][], startY: number): number {
  // Section title bar
  doc.setFillColor(245, 240, 220);
  doc.rect(14, startY, doc.internal.pageSize.getWidth() - 28, 7, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(title, 16, startY + 5);

  autoTable(doc, {
    startY: startY + 9,
    body: rows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5, textColor: DARK },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: MUTED },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
  });

  return (doc as any).lastAutoTable.finalY + 6;
}

export async function exportAnamnesePdf({
  profile,
  anamnese,
  latestMonthly,
  specialistName,
}: ExportPayload): Promise<void> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const extras = (anamnese?.dados_extras as Record<string, any>) ?? {};

  drawHeader(doc, profile, specialistName);

  let y = 50;

  // Bio data
  y = section(doc, "DADOS DO ATLETA", [
    ["Nome", profile?.nome || "—"],
    ["Idade", calcAge(profile?.nascimento)],
    ["Sexo", profile?.sexo || "—"],
    ["Peso atual", profile?.peso ? `${profile.peso} kg` : "—"],
    ["Altura", profile?.altura ? `${profile.altura} ${parseFloat(profile.altura) > 3 ? "cm" : "m"}` : "—"],
    ["Meta de peso", profile?.meta_peso ? `${profile.meta_peso} kg` : "—"],
    ["IMC (calculado)", calcIMC(profile?.peso, profile?.altura)],
    ["BF % (gordura)", profile?.body_fat != null ? `${profile.body_fat}%` : "—"],
    ["Cidade / Estado", profile?.cidade_estado || "—"],
  ], y);

  if (anamnese) {
    const dataPreenchimento = anamnese.created_at
      ? new Date(anamnese.created_at).toLocaleDateString("pt-BR")
      : "—";

    y = section(doc, "OBJETIVO E TREINO", [
      ["Objetivo", valWithOther(extras, "objetivo", "objetivo_outro", anamnese.objetivo)],
      ["Fisiculturismo", val(extras, "fisiculturismo")],
      ["Pratica musculação", val(extras, "pratica_musculacao")],
      ["Local de treino", val(extras, "local_treino", anamnese.local_treino)],
      ["Frequência semanal", val(extras, "frequencia", anamnese.frequencia_treino)],
      ["Dias da semana", val(extras, "dias_semana")],
      ["Horário do treino", val(extras, "horario_treino")],
      ["Tempo de treino", val(extras, "tempo_treino", anamnese.disponibilidade_treino)],
      ["Faz cardio", val(extras, "faz_cardio")],
      ["Tempo de cardio", val(extras, "tempo_cardio")],
      ["Experiência", val(extras, "experiencia_treino", anamnese.experiencia_treino)],
      ["Motivação", val(extras, "motivacao", anamnese.motivacao)],
    ], y);

    if (y > 240) { doc.addPage(); drawHeader(doc, profile, specialistName); y = 50; }

    y = section(doc, "ACADEMIA E LIMITAÇÕES", [
      ["Grupos prioritários", val(extras, "grupos_prioritarios")],
      ["Tem dor / lesão", val(extras, "tem_dor", anamnese.lesoes)],
      ["Exercício que não gosta", valWithOther(extras, "exercicio_nao_gosta", "exercicio_nao_gosta_desc")],
      ["Máquinas indisponíveis", valWithOther(extras, "maquinas_nao_tem", "maquina_outra", anamnese.equipamentos)],
    ], y);

    if (y > 240) { doc.addPage(); drawHeader(doc, profile, specialistName); y = 50; }

    y = section(doc, "SAÚDE", [
      ["Doenças", valWithOther(extras, "doencas", "doenca_outra", anamnese.condicoes_saude)],
      ["Histórico familiar", valWithOther(extras, "historico_familiar", "historico_familiar_desc")],
      ["Medicamentos", valWithOther(extras, "medicamentos", "medicamento_outro", anamnese.medicamentos)],
      ["Alergias", valWithOther(extras, "alergias", "alergia_outra")],
      ["Uso de hormônios", val(extras, "uso_hormonios")],
    ], y);

    if (y > 240) { doc.addPage(); drawHeader(doc, profile, specialistName); y = 50; }

    y = section(doc, "PERFIL NUTRICIONAL", [
      ["Nível de atividade", val(extras, "nivel_atividade")],
      ["Refeições por dia", val(extras, "refeicoes_dia")],
      ["Horários das refeições", val(extras, "horario_refeicoes")],
      ["Calorias diárias", val(extras, "calorias")],
      ["Tempo nesse consumo", val(extras, "tempo_calorias")],
      ["Passos / Calorias", val(extras, "passos_calorias")],
      ["Restrições", val(extras, "restricoes", anamnese.restricoes_alimentares)],
      ["Frutas preferidas", valWithOther(extras, "frutas", "fruta_outra")],
      ["Suplementos", valWithOther(extras, "suplementos", "suplemento_outro", anamnese.suplementos)],
      ["Dieta atual", val(extras, "dieta_atual", anamnese.dieta_atual)],
    ], y);

    if (y > 220) { doc.addPage(); drawHeader(doc, profile, specialistName); y = 50; }

    y = section(doc, "ESTILO DE VIDA", [
      ["Horário do sono", val(extras, "horario_sono")],
      ["Qualidade do sono", val(extras, "qualidade_sono")],
      ["Horas de sono", val(extras, "horas_sono", anamnese.sono_horas)],
      ["Nível de estresse", val(extras, "nivel_estresse", anamnese.nivel_estresse)],
      ["Alimentos diários", val(extras, "alimentos_diarios")],
      ["Alimentos que não come", val(extras, "alimentos_nao_come")],
      ["Água diária", valWithOther(extras, "agua", "agua_outra", anamnese.agua_diaria)],
      ["Líquido nas refeições", val(extras, "liquido_refeicao")],
      ["Investimento em dieta", val(extras, "investimento_dieta")],
      ["Frequência de evacuação", val(extras, "frequencia_evacuacao")],
      ["Ocupação", val(extras, "ocupacao", anamnese.ocupacao)],
    ], y);

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Anamnese preenchida em: ${dataPreenchimento}`, 14, y + 4);
  }

  // Photos page
  const photoSources = [
    { url: latestMonthly?.foto_frente, label: "Frente" },
    { url: latestMonthly?.foto_costas, label: "Costas" },
    { url: latestMonthly?.foto_lado_direito, label: "Lado Direito" },
    { url: latestMonthly?.foto_lado_esquerdo, label: "Lado Esquerdo" },
    { url: latestMonthly?.foto_perfil_lado, label: "Perfil" },
  ].filter((p) => p.url && typeof p.url === "string" && p.url.trim() !== "");

  if (photoSources.length > 0) {
    doc.addPage();
    drawHeader(doc, profile, specialistName);

    doc.setFillColor(245, 240, 220);
    doc.rect(14, 50, doc.internal.pageSize.getWidth() - 28, 7, "F");
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...DARK);
    doc.text("FOTOS DA REAVALIAÇÃO MAIS RECENTE", 16, 55);

    if (latestMonthly?.created_at) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(...MUTED);
      doc.text(
        `Tiradas em: ${new Date(latestMonthly.created_at).toLocaleDateString("pt-BR")}`,
        16,
        62,
      );
    }

    // Grid 3 cols × 2 rows on A4
    const cellW = 58;
    const cellH = 78;
    const gap = 6;
    const startX = 14;
    let startY2 = 68;

    let i = 0;
    for (const photo of photoSources) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * (cellW + gap);
      const yPos = startY2 + row * (cellH + gap + 5);

      const img = await urlToImageData(photo.url!);
      if (img) {
        // Compute aspect-fit dimensions
        const aspect = img.w / img.h;
        let w = cellW;
        let h = cellW / aspect;
        if (h > cellH) {
          h = cellH;
          w = cellH * aspect;
        }
        const offX = x + (cellW - w) / 2;
        const offY = yPos + (cellH - h) / 2;

        doc.setDrawColor(220, 220, 220);
        doc.rect(x, yPos, cellW, cellH);
        try {
          doc.addImage(img.data, "JPEG", offX, offY, w, h, undefined, "FAST");
        } catch {
          // Fallback if format detection fails
          try {
            doc.addImage(img.data, "PNG", offX, offY, w, h, undefined, "FAST");
          } catch {
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text("Indisponível", x + cellW / 2, yPos + cellH / 2, { align: "center" });
          }
        }
      } else {
        doc.setDrawColor(220, 220, 220);
        doc.setFillColor(248, 248, 248);
        doc.rect(x, yPos, cellW, cellH, "FD");
        doc.setFontSize(8);
        doc.setTextColor(...MUTED);
        doc.text("Foto indisponível", x + cellW / 2, yPos + cellH / 2, { align: "center" });
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...DARK);
      doc.text(photo.label, x + cellW / 2, yPos + cellH + 4, { align: "center" });

      i++;
    }
  }

  drawFooter(doc);

  const safeName = (profile?.nome || "atleta").replace(/[^a-zA-Z0-9_-]/g, "_");
  const dateTag = new Date().toISOString().split("T")[0];
  doc.save(`Anamnese_${safeName}_${dateTag}.pdf`);
}
