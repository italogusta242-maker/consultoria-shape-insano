export type Step =
  | "welcome"
  | "cadastro"
  | "fotos"
  | "objetivo"
  | "treino"
  | "academia"
  | "saude"
  | "nutricional"
  | "estilo_vida"
  | "ignite";

export const steps: Step[] = [
  "welcome", "cadastro", "fotos", "objetivo", "treino",
  "academia", "saude", "nutricional", "estilo_vida",
  "ignite",
];

export const stepLabels: Record<Step, string> = {
  welcome: "Início",
  cadastro: "Cadastro",
  fotos: "Fotos",
  objetivo: "Objetivo",
  treino: "Treino",
  academia: "Academia",
  saude: "Saúde",
  nutricional: "Nutrição",
  estilo_vida: "Estilo de Vida",
  ignite: "Chama",
};

export const tempoAcompanha = [
  "Menos de 3 meses", "Entre 3 e 6 meses", "Entre 6 meses e 1 ano",
  "Mais de um ano", "Vim por indicação",
];

export const comoChegouOpcoes = [
  "Instagram do Igor", "Indicação", "Publicidade", "YouTube",
];

export const maquinasAcademia = [
  "Cadeira flexora", "Mesa flexora", "Flexora em pé",
  "Hack Linear", "Hack angular",
  "Panturrilha Máquina em pé", "Panturrilha máquina sentado",
  "Cadeira abdutora (abre)", "Cadeira adutora (fecha)",
  "Leg press 45 Linear", "Leg press 45 angular", "Leg press horizontal",
  "Barra guiada Smith", "Gaiola de agachamento", "Banco romano",
  "Supino máquina articulada", "Supino inclinado máquina articulada", "Supino declinado máquina articulada",
  "Paralela", "Graviton", "Peck deck/voador",
  "Remada baixa/máquina", "Desenvolvimento máquina", "Rosca Scott máquina",
  "Elevação lateral máquina", "Elevação pélvica máquina",
  "Remada cavalinho máquina", "Puxada alta articulada",
  "Agachamento pêndulo", "Remada baixa articulada",
];

export const doencasOpcoes = [
  "Nenhuma", "Diabetes Mellitus", "Pressão alta", "Colesterol Alto", "Câncer",
  "Depressão", "Ansiedade", "Triglicerídeos Altos", "Outras",
];

export const alergiasOpcoes = ["Glúten", "Lactose", "Não tenho alergia", "Outros"];

export const medicamentosOpcoes = [
  "Nenhum", "Antidepressivo", "Ansiolítico", "Anti-hipertensivo",
  "Hipoglicemiante", "Hormônio tireoidiano", "Anticoncepcional", "Outro",
];

export const frutasOpcoes = [
  "Abacate", "Abacaxi", "Acerola", "Ameixa", "Amora", "Banana", "Caqui",
  "Goiaba", "Jabuticaba", "Kiwi", "Laranja", "Maçã", "Melão", "Melancia",
  "Mamão", "Manga", "Morango", "Pêssego", "Pera", "Uva", "Tangerina",
];

export const suplementosOpcoes = [
  "Whey protein", "Creatina", "Glutamina", "Pré treino", "BCAA",
  "Hipercalórico", "Ômega 3", "Beta Alanina", "Cafeína", "Multivitamínico", "Nenhum",
];

export const restricoesOpcoes = [
  "Ovolactovegetariano (ovos e laticínios)", "Lactovegetariano (consome laticínios)",
  "Ovovegetariano (consome ovos)", "Vegano", "Não",
];

export const caloriasOpcoes = [
  "Menos de 1500", "1500 até 2000", "2000 até 2500", "2500 até 3000",
  "3000 até 3500", "Mais de 3500", "Não sei",
];

export const aguaOpcoes = [
  "Menos de 1 litro", "1L", "1,5L", "2L", "2,5L", "3L", "4L ou mais",
];

export const faixasSalariais = [
  "Menos de R$1.500", "R$1.500 a R$2.500", "R$2.500 a R$3.500",
  "R$3.500 a R$5.000", "R$5.000 a R$7.000", "R$7.000 a R$10.000",
  "R$10.000 a R$15.000", "Mais de R$15.000",
];

export interface UserData {
  // Cadastro
  nome: string;
  email: string;
  telefone: string;
  nascimento: string;
  cpf: string;
  cep: string;
  logradouro: string;
  bairro: string;
  cidade_estado: string;
  sexo: string;
  tempo_acompanha: string;
  altura: string;
  fatores_escolha: string;
  peso: string;
  meta_peso: string;
  como_chegou: string;
  indicacao: string;
  indicacao_nome: string;
  indicacao_telefone: string;
  // Fotos
  foto_frente: File | null;
  foto_costas: File | null;
  foto_direito: File | null;
  foto_esquerdo: File | null;
  foto_perfil: File | null;
  // Objetivo
  objetivo: string;
  objetivo_outro: string;
  fisiculturismo: string;
  influenciador_favorito: string;
  foto_pose_frente: File | null;
  foto_pose_lado: File | null;
  foto_pose_costas: File | null;
  // Treino
  pratica_musculacao: string;
  local_treino: string;
  maquinas_casa: string;
  dias_semana: string[];
  frequencia: string;
  horario_treino: string;
  tempo_treino: string;
  tempo_cardio: string;
  treino_antigo: File | null;
  // Academia
  grupos_prioritarios: string;
  tem_dor: string;
  descricao_dor: string;
  exercicio_nao_gosta: string;
  exercicio_nao_gosta_desc: string;
  maquinas_nao_tem: string[];
  maquina_outra: string;
  // Saude
  doencas: string[];
  doenca_outra: string;
  historico_familiar: string;
  historico_familiar_desc: string;
  medicamentos: string[];
  medicamento_outro: string;
  alergias: string[];
  alergia_outra: string;
  // Nutricional
  nivel_atividade: string;
  faz_cardio: string;
  tempo_cardio_nutri: string;
  refeicoes_dia: string;
  horario_refeicoes: string;
  calorias: string;
  tempo_calorias: string;
  restricoes: string[];
  frutas: string[];
  fruta_outra: string;
  suplementos: string[];
  suplemento_outro: string;
  // Saude extra
  frequencia_evacuacao: string;
  exame_sangue: File | null;
  // Estilo de Vida
  horario_sono: string;
  qualidade_sono: string;
  alimentos_diarios: string;
  alimentos_nao_come: string;
  agua: string;
  agua_outra: string;
  liquido_refeicao: string;
  liquido_qual: string;
  investimento_dieta: string;
  faixa_salarial: string;
}

export const initialUserData: UserData = {
  nome: "", email: "", telefone: "", nascimento: "", cpf: "", cep: "", logradouro: "", bairro: "", cidade_estado: "",
  sexo: "", tempo_acompanha: "", altura: "", fatores_escolha: "", peso: "", meta_peso: "", como_chegou: "",
  indicacao: "", indicacao_nome: "", indicacao_telefone: "",
  foto_frente: null, foto_costas: null, foto_direito: null, foto_esquerdo: null, foto_perfil: null,
  objetivo: "", objetivo_outro: "", fisiculturismo: "", influenciador_favorito: "",
  foto_pose_frente: null, foto_pose_lado: null, foto_pose_costas: null,
  pratica_musculacao: "", local_treino: "", maquinas_casa: "",
  dias_semana: [], frequencia: "", horario_treino: "", tempo_treino: "", tempo_cardio: "",
  treino_antigo: null,
  grupos_prioritarios: "", tem_dor: "", descricao_dor: "",
  exercicio_nao_gosta: "", exercicio_nao_gosta_desc: "",
  maquinas_nao_tem: [], maquina_outra: "",
  doencas: [], doenca_outra: "", historico_familiar: "", historico_familiar_desc: "",
  medicamentos: [], medicamento_outro: "", alergias: [], alergia_outra: "",
  frequencia_evacuacao: "", exame_sangue: null,
  nivel_atividade: "", faz_cardio: "", tempo_cardio_nutri: "",
  refeicoes_dia: "", horario_refeicoes: "", calorias: "", tempo_calorias: "",
  restricoes: [], frutas: [], fruta_outra: "", suplementos: [], suplemento_outro: "",
  horario_sono: "", qualidade_sono: "", alimentos_diarios: "", alimentos_nao_come: "",
  agua: "", agua_outra: "", liquido_refeicao: "", liquido_qual: "",
  investimento_dieta: "", faixa_salarial: "",
};

// Validation rules per step
export const stepValidation: Partial<Record<Step, (data: UserData) => string[]>> = {
  cadastro: (d) => {
    const required: (keyof UserData)[] = ["nome", "email", "telefone", "nascimento", "cidade_estado", "sexo", "altura", "peso", "tempo_acompanha", "fatores_escolha", "indicacao", "como_chegou"];
    return required.filter(k => {
      const v = d[k];
      return !v || (typeof v === "string" && v.trim() === "");
    });
  },
  treino: (d) => {
    const required: (keyof UserData)[] = ["pratica_musculacao", "local_treino", "frequencia", "horario_treino", "tempo_treino", "tempo_cardio"];
    const missing = required.filter(k => !d[k] || (typeof d[k] === "string" && (d[k] as string).trim() === ""));
    if (d.dias_semana.length === 0) missing.push("dias_semana");
    return missing;
  },
  academia: (d) => {
    const missing: string[] = [];
    if (!d.grupos_prioritarios.trim()) missing.push("grupos_prioritarios");
    if (!d.tem_dor) missing.push("tem_dor");
    if (!d.exercicio_nao_gosta) missing.push("exercicio_nao_gosta");
    if (d.maquinas_nao_tem.length === 0) missing.push("maquinas_nao_tem");
    return missing;
  },
  saude: (d) => {
    const missing: string[] = [];
    if (d.doencas.length === 0) missing.push("doencas");
    if (!d.historico_familiar) missing.push("historico_familiar");
    if (d.medicamentos.length === 0) missing.push("medicamentos");
    if (d.alergias.length === 0) missing.push("alergias");
    if (!d.frequencia_evacuacao) missing.push("frequencia_evacuacao");
    return missing;
  },
  nutricional: (d) => {
    const missing: string[] = [];
    if (!d.nivel_atividade) missing.push("nivel_atividade");
    if (!d.refeicoes_dia) missing.push("refeicoes_dia");
    if (!d.horario_refeicoes.trim()) missing.push("horario_refeicoes");
    if (!d.calorias) missing.push("calorias");
    if (d.restricoes.length === 0) missing.push("restricoes");
    if (d.frutas.length < 5) missing.push("frutas");
    if (d.suplementos.length === 0) missing.push("suplementos");
    return missing;
  },
  estilo_vida: (d) => {
    const missing: string[] = [];
    if (!d.horario_sono.trim()) missing.push("horario_sono");
    if (!d.qualidade_sono) missing.push("qualidade_sono");
    if (!d.alimentos_diarios.trim()) missing.push("alimentos_diarios");
    if (!d.alimentos_nao_come.trim()) missing.push("alimentos_nao_come");
    if (!d.agua) missing.push("agua");
    if (!d.liquido_refeicao) missing.push("liquido_refeicao");
    if (!d.investimento_dieta) missing.push("investimento_dieta");
    return missing;
  },
  fotos: (d) => {
    const missing: string[] = [];
    if (!d.foto_frente) missing.push("foto_frente");
    if (!d.foto_costas) missing.push("foto_costas");
    if (!d.foto_direito) missing.push("foto_direito");
    if (!d.foto_esquerdo) missing.push("foto_esquerdo");
    if (!d.foto_perfil) missing.push("foto_perfil");
    return missing;
  },
  objetivo: (d) => {
    const missing: string[] = [];
    if (!d.objetivo || d.objetivo.trim() === "") missing.push("objetivo");
    return missing;
  },
};
