
-- Table for monthly reassessments
CREATE TABLE public.monthly_assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),

  -- Personal (can change monthly)
  altura TEXT,
  peso TEXT,

  -- Photos (stored as URLs from storage)
  foto_frente TEXT,
  foto_costas TEXT,
  foto_lado_direito TEXT,
  foto_lado_esquerdo TEXT,
  foto_perfil_lado TEXT,

  -- Training modality
  modalidade TEXT, -- 'musculacao' | 'hibrido'

  -- Fatigue level 0-4
  nivel_fadiga INTEGER,

  -- Muscle group progression (true=yes, false=no, null=N/A)
  progresso_peitoral BOOLEAN,
  progresso_costas BOOLEAN,
  progresso_deltoide BOOLEAN,
  progresso_triceps BOOLEAN,
  progresso_biceps BOOLEAN,
  progresso_quadriceps BOOLEAN,
  progresso_posteriores BOOLEAN,
  progresso_gluteos BOOLEAN,
  progresso_panturrilha BOOLEAN,
  progresso_abdomen TEXT, -- 'sim' | 'nao' | 'nao_tenho'
  progresso_antebraco TEXT, -- 'sim' | 'nao' | 'nao_tenho'

  -- Notes on lack of progression
  notas_progressao TEXT,

  -- Physical improvement priorities
  prioridades_fisicas TEXT,

  -- Training schedule
  dias_disponiveis TEXT[], -- array of weekdays
  frequencia_compromisso TEXT,
  tempo_disponivel TEXT,

  -- Equipment NOT available
  maquinas_indisponiveis TEXT[],

  -- Adherence scores (1-10)
  adesao_treinos INTEGER,
  motivo_adesao_treinos TEXT,
  adesao_cardios INTEGER,
  motivo_adesao_cardios TEXT,
  alongamentos_corretos BOOLEAN,

  -- Diet
  refeicoes_horarios TEXT, -- 'mesmos' or custom text
  horario_treino TEXT, -- 'mesmos' or custom text
  horario_treino_outro TEXT,
  objetivo_atual TEXT, -- 'perda_gordura' | 'ganho_massa' | 'profissionais'
  competicao_fisiculturismo TEXT,
  restricao_alimentar TEXT,
  alimentos_proibidos TEXT,
  adesao_dieta TEXT, -- '100%' | '80%' | '50%' | 'nao_consegui'
  motivo_nao_dieta TEXT,
  sugestao_dieta TEXT,

  -- Authorization
  autoriza_publicacao BOOLEAN,

  -- General suggestion
  sugestao_melhoria TEXT
);

-- Enable RLS
ALTER TABLE public.monthly_assessments ENABLE ROW LEVEL SECURITY;

-- Users read own assessments
CREATE POLICY "Users read own monthly assessments"
  ON public.monthly_assessments FOR SELECT
  USING (auth.uid() = user_id);

-- Users insert own assessments
CREATE POLICY "Users insert own monthly assessments"
  ON public.monthly_assessments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Specialists read assessments of their students
CREATE POLICY "Especialistas read monthly assessments"
  ON public.monthly_assessments FOR SELECT
  USING (has_role(auth.uid(), 'especialista'::app_role));

-- Admins read all
CREATE POLICY "Admins read all monthly assessments"
  ON public.monthly_assessments FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
