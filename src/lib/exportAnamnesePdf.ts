/**
 * @purpose Generate a professional, vector-based PDF of an athlete's anamnese.
 *          Text is selectable & searchable (not a screenshot).
 *          Inclui TODOS os campos preenchidos pelo aluno (anamnese inicial + reavaliação),
 *          mais um bloco final que captura quaisquer campos extras de `dados_extras`
 *          que não estejam na lista canônica — garantindo zero perda de informação.
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

interface MonthlyAssessmentLike {
  foto_frente?: string | null;
  foto_costas?: string | null;
  foto_lado_direito?: string | null;
  foto_lado_esquerdo?: string | null;
  foto_perfil_lado?: string | null;
  created_at?: string;
  peso?: string | null;
  altura?: string | null;
  modalidade?: string | null;
  nivel_fadiga?: number | null;
  objetivo_atual?: string | null;
  frequencia_compromisso?: string | null;
  tempo_disponivel?: string | null;
  dias_disponiveis?: string[] | null;
  adesao_treinos?: number | null;
  motivo_adesao_treinos?: string | null;
  adesao_cardios?: number | null;
  motivo_adesao_cardios?: string | null;
  adesao_dieta?: string | null;
  horario_treino?: string | null;
  horario_treino_outro?: string | null;
  refeicoes_horarios?: string | null;
  alongamentos_corretos?: boolean | null;
  competicao_fisiculturismo?: string | null;
  restricao_alimentar?: string | null;
  alimentos_proibidos?: string | null;
  prioridades_fisicas?: string | null;
  notas_progressao?: string | null;
  motivo_nao_dieta?: string | null;
  sugestao_dieta?: string | null;
  sugestao_melhoria?: string | null;
  autoriza_publicacao?: boolean | null;
  maquinas_indisponiveis?: string[] | null;
  progresso_peitoral?: boolean | null;
  progresso_costas?: boolean | null;
  progresso_deltoide?: boolean | null;
  progresso_triceps?: boolean | null;
  progresso_biceps?: boolean | null;
  progresso_quadriceps?: boolean | null;
  progresso_posteriores?: boolean | null;
  progresso_gluteos?: boolean | null;
  progresso_panturrilha?: boolean | null;
  progresso_abdomen?: string | null;
  progresso_antebraco?: string | null;
  [key: string]: any;
}

interface ExportPayload {
  profile: ProfileLike | null;
  anamnese: AnamneseLike | null;
  latestMonthly?: MonthlyAssessmentLike | null;
  specialistName?: string;
}

const GOLD: [number, number, number] = [212, 175, 55];
const DARK: [number, number, number] = [30, 30, 32];
const MUTED: [number, number, number] = [120, 120, 125];

/** Lista canônica de chaves de `dados_extras` que já são exibidas em alguma seção.
 *  Usada para detectar campos "órfãos" preenchidos pelo aluno e incluí-los
 *  no bloco de "Informações Complementares". */
const KNOWN_EXTRA_KEYS = new Set<string>([
  "objetivo", "objetivo_outro",
  "fisiculturismo", "pratica_musculacao",
  "local_treino", "frequencia", "dias_semana", "horario_treino",
  "tempo_treino", "faz_cardio", "tempo_cardio",
  "experiencia_treino", "motivacao",
  "grupos_prioritarios", "tem_dor", "tem_dor_desc",
  "exercicio_nao_gosta", "exercicio_nao_gosta_desc",
  "maquinas_nao_tem", "maquina_outra",
  "doencas", "doenca_outra",
  "historico_familiar", "historico_familiar_desc",
  "medicamentos", "medicamento_outro",
  "alergias", "alergia_outra",
  "uso_hormonios",
  "nivel_atividade", "refeicoes_dia", "horario_refeicoes",
  "calorias", "tempo_calorias", "passos_calorias",
  "restricoes", "frutas", "fruta_outra",
  "suplementos", "suplemento_outro", "dieta_atual",
  "horario_sono", "qualidade_sono", "horas_sono",
  "nivel_estresse", "alimentos_diarios", "alimentos_nao_come",
  "agua", "agua_outra", "liquido_refeicao", "liquido_qual",
  "investimento_dieta", "frequencia_evacuacao",
  "sintomas_digestao", "escala_bristol",
  "ocupacao", "faixa_salarial", "influenciador_favorito",
]);

function val(extras: Record<string, any>, key: string, fallback?: string | null): string {
  const v = extras[key];
  if (v != null && v !== "") {
    if (Array.isArray(v)) return v.join(", ") || "—";
    if (typeof v === "boolean") return v ? "Sim" : "Não";
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

/** Converte boolean/array/null em string apresentável; retorna null se "vazio". */
function presentable(v: any): string | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v ? "Sim" : "Não";
  if (Array.isArray(v)) {
    const joined = v.filter((x) => x != null && x !== "").join(", ");
    return joined || null;
  }
  if (typeof v === "object") {
    try {
      const j = JSON.stringify(v);
      return j === "{}" ? null : j;
    } catch {
      return null;
    }
  }
  const s = String(v).trim();
  return s === "" ? null : s;
}

/** Humaniza uma chave snake_case em "Snake Case". */
function humanize(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
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

/**
 * Detect "all-black" / single-color JPEGs that come from failed HEIC decodes
 * on the student's device. Returns true if the image is monochrome (broken).
 */
function isMonochromeImage(dataUrl: string, w: number, h: number): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return false;
    const tempImg = new Image();
    tempImg.src = dataUrl;
    // Image is already loaded (we just measured it); draw synchronously.
    ctx.drawImage(tempImg, 0, 0, w, h);
    const samples = 24;
    const stepX = Math.max(1, Math.floor(w / samples));
    const stepY = Math.max(1, Math.floor(h / samples));
    const data = ctx.getImageData(0, 0, w, h).data;
    let firstR = -1, firstG = -1, firstB = -1;
    for (let y = 0; y < h; y += stepY) {
      for (let x = 0; x < w; x += stepX) {
        const i = (y * w + x) * 4;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        if (firstR === -1) { firstR = r; firstG = g; firstB = b; continue; }
        if (Math.abs(r - firstR) > 6 || Math.abs(g - firstG) > 6 || Math.abs(b - firstB) > 6) {
          return false;
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}

async function urlToImageData(
  url: string
): Promise<{ data: string; w: number; h: number; broken?: boolean } | null> {
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
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 0, h: 0 });
      img.src = dataUrl;
    });
    if (dims.w === 0 || dims.h === 0) return null;
    const broken = isMonochromeImage(dataUrl, dims.w, dims.h);
    return { data: dataUrl, w: dims.w, h: dims.h, broken };
  } catch {
    return null;
  }
}

function drawHeader(doc: jsPDF, profile: ProfileLike | null, specialistName?: string) {
  const pageW = doc.internal.pageSize.getWidth();
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
  doc.text(`Exportado em: ${dateStr}`, pageW - 14, 22, { align: "right" });
  if (specialistName) {
    doc.text(`Por: ${specialistName}`, pageW - 14, 28, { align: "right" });
  }

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

/** Renderiza uma seção com auto-pagebreak. Aceita rows mistas (string ou null para pular). */
function section(
  doc: jsPDF,
  title: string,
  rows: Array<[string, string | null | undefined]>,
  startY: number,
  profile: ProfileLike | null,
  specialistName?: string,
): number {
  // Filtra linhas com valor nulo/vazio? Mantemos "—" para registrar campo não preenchido,
  // mas pulamos quando o valor é null (usado para campos só renderizados se houver dados).
  const filteredRows = rows
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([k, v]) => [k, v as string] as [string, string]);

  if (filteredRows.length === 0) return startY;

  // Quebra de página antecipada se restar pouco espaço
  const pageH = doc.internal.pageSize.getHeight();
  if (startY > pageH - 40) {
    doc.addPage();
    drawHeader(doc, profile, specialistName);
    startY = 50;
  }

  doc.setFillColor(245, 240, 220);
  doc.rect(14, startY, doc.internal.pageSize.getWidth() - 28, 7, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...DARK);
  doc.text(title, 16, startY + 5);

  autoTable(doc, {
    startY: startY + 9,
    body: filteredRows,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 1.5, textColor: DARK, overflow: "linebreak" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 55, textColor: MUTED },
      1: { cellWidth: "auto" },
    },
    margin: { left: 14, right: 14 },
    didDrawPage: () => {
      // Header is drawn manually after pagebreak inside this loop; jspdf-autotable
      // already starts at top of new page automatically.
    },
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

  // ---------- DADOS DO ATLETA ----------
  y = section(doc, "DADOS DO ATLETA", [
    ["Nome", profile?.nome || "—"],
    ["Idade", calcAge(profile?.nascimento)],
    ["Data de nascimento", profile?.nascimento || "—"],
    ["Sexo", profile?.sexo || "—"],
    ["Peso atual", profile?.peso ? `${profile.peso} kg` : "—"],
    ["Altura", profile?.altura ? `${profile.altura} ${parseFloat(profile.altura) > 3 ? "cm" : "m"}` : "—"],
    ["Meta de peso", profile?.meta_peso ? `${profile.meta_peso} kg` : "—"],
    ["IMC (calculado)", calcIMC(profile?.peso, profile?.altura)],
    ["BF % (gordura)", profile?.body_fat != null ? `${profile.body_fat}%` : "—"],
    ["E-mail", profile?.email || "—"],
    ["Telefone", profile?.telefone || "—"],
    ["CPF", profile?.cpf || "—"],
    ["Cidade / Estado", profile?.cidade_estado || "—"],
  ], y, profile, specialistName);

  if (anamnese) {
    const dataPreenchimento = anamnese.created_at
      ? new Date(anamnese.created_at).toLocaleDateString("pt-BR")
      : "—";

    // ---------- OBJETIVO E TREINO ----------
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
    ], y, profile, specialistName);

    // ---------- ACADEMIA E LIMITAÇÕES ----------
    y = section(doc, "ACADEMIA E LIMITAÇÕES", [
      ["Grupos prioritários", val(extras, "grupos_prioritarios")],
      ["Tem dor / lesão", valWithOther(extras, "tem_dor", "tem_dor_desc", anamnese.lesoes)],
      ["Exercício que não gosta", valWithOther(extras, "exercicio_nao_gosta", "exercicio_nao_gosta_desc")],
      ["Máquinas indisponíveis", valWithOther(extras, "maquinas_nao_tem", "maquina_outra", anamnese.equipamentos)],
    ], y, profile, specialistName);

    // ---------- SAÚDE ----------
    y = section(doc, "SAÚDE", [
      ["Doenças", valWithOther(extras, "doencas", "doenca_outra", anamnese.condicoes_saude)],
      ["Histórico familiar", valWithOther(extras, "historico_familiar", "historico_familiar_desc")],
      ["Medicamentos", valWithOther(extras, "medicamentos", "medicamento_outro", anamnese.medicamentos)],
      ["Alergias", valWithOther(extras, "alergias", "alergia_outra")],
      ["Uso de hormônios", val(extras, "uso_hormonios")],
    ], y, profile, specialistName);

    // ---------- PERFIL NUTRICIONAL ----------
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
    ], y, profile, specialistName);

    // ---------- ESTILO DE VIDA ----------
    y = section(doc, "ESTILO DE VIDA", [
      ["Horário do sono", val(extras, "horario_sono")],
      ["Qualidade do sono", val(extras, "qualidade_sono")],
      ["Horas de sono", val(extras, "horas_sono", anamnese.sono_horas)],
      ["Nível de estresse", val(extras, "nivel_estresse", anamnese.nivel_estresse)],
      ["Alimentos diários", val(extras, "alimentos_diarios")],
      ["Alimentos que não come", val(extras, "alimentos_nao_come")],
      ["Água diária", valWithOther(extras, "agua", "agua_outra", anamnese.agua_diaria)],
      ["Líquido nas refeições", val(extras, "liquido_refeicao")],
      ["Qual líquido", val(extras, "liquido_qual")],
      ["Investimento em dieta", val(extras, "investimento_dieta")],
      ["Frequência de evacuação", val(extras, "frequencia_evacuacao")],
      ["Sintomas de digestão", val(extras, "sintomas_digestao")],
      ["Escala de Bristol", val(extras, "escala_bristol")],
      ["Ocupação", val(extras, "ocupacao", anamnese.ocupacao)],
      ["Faixa salarial", val(extras, "faixa_salarial")],
      ["Influenciador favorito", val(extras, "influenciador_favorito")],
    ], y, profile, specialistName);

    // ---------- INFORMAÇÕES COMPLEMENTARES ----------
    // Captura QUALQUER outro campo preenchido em `dados_extras` que ainda não
    // tenha sido renderizado nas seções acima — garante zero perda de dado.
    const orphanRows: Array<[string, string]> = [];
    for (const [key, raw] of Object.entries(extras)) {
      if (KNOWN_EXTRA_KEYS.has(key)) continue;
      const value = presentable(raw);
      if (value) orphanRows.push([humanize(key), value]);
    }
    if (orphanRows.length > 0) {
      y = section(doc, "INFORMAÇÕES COMPLEMENTARES", orphanRows, y, profile, specialistName);
    }

    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    if (y > doc.internal.pageSize.getHeight() - 15) {
      doc.addPage();
      drawHeader(doc, profile, specialistName);
      y = 50;
    }
    doc.text(`Anamnese preenchida em: ${dataPreenchimento}`, 14, y + 4);
    y += 8;
  }

  // ---------- REAVALIAÇÃO MENSAL (DADOS) ----------
  if (latestMonthly) {
    doc.addPage();
    drawHeader(doc, profile, specialistName);
    y = 50;

    const dataReav = latestMonthly.created_at
      ? new Date(latestMonthly.created_at).toLocaleDateString("pt-BR")
      : "—";

    doc.setFontSize(9);
    doc.setTextColor(...MUTED);
    doc.text(`Reavaliação realizada em: ${dataReav}`, 14, y);
    y += 6;

    // Métricas e adesão
    const metricRows: Array<[string, string | null]> = [
      ["Peso", latestMonthly.peso ? `${latestMonthly.peso} kg` : null],
      ["Altura", latestMonthly.altura || null],
      ["Modalidade", latestMonthly.modalidade || null],
      ["Nível de fadiga", latestMonthly.nivel_fadiga != null ? `${latestMonthly.nivel_fadiga}/10` : null],
      ["Objetivo atual", latestMonthly.objetivo_atual || null],
      ["Frequência de compromisso", latestMonthly.frequencia_compromisso || null],
      ["Tempo disponível", latestMonthly.tempo_disponivel || null],
      ["Dias disponíveis", latestMonthly.dias_disponiveis?.length ? latestMonthly.dias_disponiveis.join(", ") : null],
      ["Horário do treino", [latestMonthly.horario_treino, latestMonthly.horario_treino_outro].filter(Boolean).join(" / ") || null],
      ["Refeições / horários", latestMonthly.refeicoes_horarios || null],
      ["Adesão aos treinos", latestMonthly.adesao_treinos != null ? `${latestMonthly.adesao_treinos}%` : null],
      ["Motivo (treinos)", latestMonthly.motivo_adesao_treinos || null],
      ["Adesão ao cardio", latestMonthly.adesao_cardios != null ? `${latestMonthly.adesao_cardios}%` : null],
      ["Motivo (cardio)", latestMonthly.motivo_adesao_cardios || null],
      ["Adesão à dieta", latestMonthly.adesao_dieta || null],
      ["Motivo (não dieta)", latestMonthly.motivo_nao_dieta || null],
      ["Alongamentos corretos", latestMonthly.alongamentos_corretos === true ? "Sim" : latestMonthly.alongamentos_corretos === false ? "Não" : null],
      ["Competição fisiculturismo", latestMonthly.competicao_fisiculturismo || null],
      ["Restrição alimentar", latestMonthly.restricao_alimentar || null],
      ["Alimentos proibidos", latestMonthly.alimentos_proibidos || null],
      ["Prioridades físicas", latestMonthly.prioridades_fisicas || null],
      ["Notas de progressão", latestMonthly.notas_progressao || null],
      ["Sugestão de dieta", latestMonthly.sugestao_dieta || null],
      ["Sugestão de melhoria", latestMonthly.sugestao_melhoria || null],
      ["Autoriza publicação", latestMonthly.autoriza_publicacao === true ? "Sim" : latestMonthly.autoriza_publicacao === false ? "Não" : null],
      ["Máquinas indisponíveis", latestMonthly.maquinas_indisponiveis?.length ? latestMonthly.maquinas_indisponiveis.join(", ") : null],
    ];

    y = section(doc, "REAVALIAÇÃO MENSAL · MÉTRICAS E ADESÃO", metricRows, y, profile, specialistName);

    // Progressão muscular
    const progressGroups: Array<[string, boolean | string | null | undefined]> = [
      ["Peitoral", latestMonthly.progresso_peitoral],
      ["Costas", latestMonthly.progresso_costas],
      ["Deltóide", latestMonthly.progresso_deltoide],
      ["Tríceps", latestMonthly.progresso_triceps],
      ["Bíceps", latestMonthly.progresso_biceps],
      ["Quadríceps", latestMonthly.progresso_quadriceps],
      ["Posteriores", latestMonthly.progresso_posteriores],
      ["Glúteos", latestMonthly.progresso_gluteos],
      ["Panturrilha", latestMonthly.progresso_panturrilha],
      ["Abdômen", latestMonthly.progresso_abdomen],
      ["Antebraço", latestMonthly.progresso_antebraco],
    ];
    const progressRows: Array<[string, string | null]> = progressGroups.map(([label, v]) => {
      if (v == null || v === "") return [label, null];
      if (typeof v === "boolean") return [label, v ? "Evoluiu ✓" : "Sem evolução ✗"];
      return [label, String(v)];
    });
    y = section(doc, "REAVALIAÇÃO MENSAL · PROGRESSÃO MUSCULAR", progressRows, y, profile, specialistName);
  }

  // ---------- FOTOS DA REAVALIAÇÃO ----------
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

    const cellW = 58;
    const cellH = 78;
    const gap = 6;
    const startX = 14;
    const startY2 = 68;

    let i = 0;
    for (const photo of photoSources) {
      const col = i % 3;
      const row = Math.floor(i / 3);
      const x = startX + col * (cellW + gap);
      const yPos = startY2 + row * (cellH + gap + 5);

      const img = await urlToImageData(photo.url!);
      if (img && !img.broken) {
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
          try {
            doc.addImage(img.data, "PNG", offX, offY, w, h, undefined, "FAST");
          } catch {
            doc.setFontSize(8);
            doc.setTextColor(...MUTED);
            doc.text("Indisponível", x + cellW / 2, yPos + cellH / 2, { align: "center" });
          }
        }
      } else if (img && img.broken) {
        // Photo uploaded but is all-black (HEIC decode failure on student device)
        doc.setDrawColor(220, 180, 180);
        doc.setFillColor(252, 245, 245);
        doc.rect(x, yPos, cellW, cellH, "FD");
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(180, 60, 60);
        doc.text("Foto corrompida", x + cellW / 2, yPos + cellH / 2 - 6, { align: "center" });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...MUTED);
        doc.text("(falha no upload)", x + cellW / 2, yPos + cellH / 2, { align: "center" });
        doc.text("Solicitar reenvio", x + cellW / 2, yPos + cellH / 2 + 5, { align: "center" });
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
