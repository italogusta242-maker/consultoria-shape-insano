export type MonthlyStep =
  | "dados"
  | "fotos"
  | "treino_modalidade"
  | "progressao"
  | "prioridades"
  | "disponibilidade"
  | "equipamentos"
  | "adesao"
  | "dieta"
  | "finalizacao";

export const monthlySteps: MonthlyStep[] = [
  "dados", "fotos", "treino_modalidade", "progressao", "prioridades",
  "disponibilidade", "equipamentos", "adesao", "dieta", "finalizacao",
];

export const monthlyStepLabels: Record<MonthlyStep, string> = {
  dados: "Dados Básicos",
  fotos: "Análise Postural",
  treino_modalidade: "Modalidade",
  progressao: "Progressão",
  prioridades: "Prioridades",
  disponibilidade: "Disponibilidade",
  equipamentos: "Equipamentos",
  adesao: "Adesão",
  dieta: "Dieta",
  finalizacao: "Finalização",
};

export const maquinasDisponiveis = [
  "Cadeira flexora", "Mesa flexora", "Flexora em pé",
  "Hack linear", "Hack angular",
  "Panturrilha máquina em pé", "Panturrilha máquina sentado",
  "Cadeira abdutora", "Cadeira adutora",
  "Leg press 45 linear", "Leg press horizontal", "Leg press articulado/angular",
  "Barra guiada/smith", "Gaiola de agachamento", "Banco romano",
  "Supino máquina articulado", "Supino inclinado máquina articulado", "Supino declinado máquina articulado",
  "Paralelas", "Gráviton", "Peck deck/voador máquina",
  "Remada baixa máquina", "Desenvolvimento máquina", "Rosca scott máquina",
  "Elevação lateral máquina", "Elevação pélvica máquina", "Remada cavalinho máquina",
];

export const diasSemana = [
  "Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado",
];

export const frequenciaOpcoes = [
  "Até 2 dias na semana",
  "Até 3 dias na semana",
  "Até 4 dias na semana",
  "Até 5 dias na semana",
  "Até 6 dias na semana",
  "Até 7 dias na semana",
];

export const tempoTreinoOpcoes = [
  "Menos de 1 hora", "1 hora", "1 hora e 30 min", "2 horas", "Mais de 2 horas",
];

export interface MonthlyFormData {
  altura: string;
  peso: string;
  foto_frente: File | null;
  foto_costas: File | null;
  foto_lado_direito: File | null;
  foto_lado_esquerdo: File | null;
  foto_perfil_lado: File | null;
  modalidade: string;
  nivel_fadiga: string;
  progresso_peitoral: string;
  progresso_costas: string;
  progresso_deltoide: string;
  progresso_triceps: string;
  progresso_biceps: string;
  progresso_quadriceps: string;
  progresso_posteriores: string;
  progresso_gluteos: string;
  progresso_panturrilha: string;
  progresso_abdomen: string;
  progresso_antebraco: string;
  notas_progressao: string;
  prioridades_fisicas: string;
  dias_disponiveis: string[];
  frequencia_compromisso: string;
  tempo_disponivel: string;
  maquinas_indisponiveis: string[];
  adesao_treinos: string;
  motivo_adesao_treinos: string;
  adesao_cardios: string;
  motivo_adesao_cardios: string;
  alongamentos_corretos: string;
  refeicoes_horarios: string;
  refeicoes_horarios_outro: string;
  horario_treino: string;
  horario_treino_outro: string;
  objetivo_atual: string;
  competicao_fisiculturismo: string;
  restricao_alimentar: string;
  alimentos_proibidos: string;
  adesao_dieta: string;
  motivo_nao_dieta: string;
  sugestao_dieta: string;
  autoriza_publicacao: string;
  sugestao_melhoria: string;
}

export const initialMonthlyFormData: MonthlyFormData = {
  altura: "", peso: "",
  foto_frente: null, foto_costas: null, foto_lado_direito: null, foto_lado_esquerdo: null, foto_perfil_lado: null,
  modalidade: "", nivel_fadiga: "",
  progresso_peitoral: "", progresso_costas: "", progresso_deltoide: "",
  progresso_triceps: "", progresso_biceps: "", progresso_quadriceps: "",
  progresso_posteriores: "", progresso_gluteos: "", progresso_panturrilha: "",
  progresso_abdomen: "", progresso_antebraco: "",
  notas_progressao: "", prioridades_fisicas: "",
  dias_disponiveis: [], frequencia_compromisso: "", tempo_disponivel: "",
  maquinas_indisponiveis: [],
  adesao_treinos: "", motivo_adesao_treinos: "",
  adesao_cardios: "", motivo_adesao_cardios: "",
  alongamentos_corretos: "",
  refeicoes_horarios: "", refeicoes_horarios_outro: "",
  horario_treino: "", horario_treino_outro: "",
  objetivo_atual: "", competicao_fisiculturismo: "",
  restricao_alimentar: "", alimentos_proibidos: "",
  adesao_dieta: "", motivo_nao_dieta: "", sugestao_dieta: "",
  autoriza_publicacao: "", sugestao_melhoria: "",
};
