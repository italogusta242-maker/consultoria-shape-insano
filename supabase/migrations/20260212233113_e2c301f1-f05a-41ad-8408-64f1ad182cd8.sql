
-- Enum para roles
CREATE TYPE public.app_role AS ENUM ('admin', 'especialista', 'user');

-- Enum para classes
CREATE TYPE public.classe_type AS ENUM ('gladius', 'velite', 'centurio');

-- Enum para ligas
CREATE TYPE public.league_type AS ENUM ('plebe', 'legionario', 'centuriao', 'pretoriano');

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT,
  email TEXT,
  telefone TEXT,
  nascimento TEXT,
  cpf TEXT,
  cidade_estado TEXT,
  sexo TEXT,
  faixa_etaria TEXT,
  altura TEXT,
  peso TEXT,
  tempo_acompanha TEXT,
  fatores_escolha TEXT,
  indicacao TEXT,
  indicacao_nome TEXT,
  indicacao_telefone TEXT,
  classe classe_type DEFAULT 'gladius',
  onboarded BOOLEAN NOT NULL DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- USER_ROLES
-- ============================================================
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- GAMIFICATION
-- ============================================================
CREATE TABLE public.gamification (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  league league_type NOT NULL DEFAULT 'plebe',
  streak INTEGER NOT NULL DEFAULT 0,
  max_streak INTEGER NOT NULL DEFAULT 0,
  dracmas INTEGER NOT NULL DEFAULT 0,
  flame_percent INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.gamification ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ANAMNESE
-- ============================================================
CREATE TABLE public.anamnese (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objetivo TEXT,
  experiencia_treino TEXT,
  frequencia_treino TEXT,
  local_treino TEXT,
  equipamentos TEXT,
  lesoes TEXT,
  medicamentos TEXT,
  condicoes_saude TEXT,
  dieta_atual TEXT,
  restricoes_alimentares TEXT,
  suplementos TEXT,
  agua_diaria TEXT,
  sono_horas TEXT,
  nivel_estresse TEXT,
  ocupacao TEXT,
  disponibilidade_treino TEXT,
  motivacao TEXT,
  dados_extras JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.anamnese ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- WORKOUTS
-- ============================================================
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  exercises JSONB DEFAULT '[]',
  xp_earned INTEGER NOT NULL DEFAULT 0,
  dracmas_earned INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ACHIEVEMENTS
-- ============================================================
CREATE TABLE public.achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- SECURITY DEFINER FUNCTION for roles
-- ============================================================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================================
-- AUTO-CREATE PROFILE on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  
  INSERT INTO public.gamification (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- RLS POLICIES - profiles
-- ============================================================
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Especialistas read profiles"
  ON public.profiles FOR SELECT
  USING (public.has_role(auth.uid(), 'especialista'));

-- ============================================================
-- RLS POLICIES - user_roles
-- ============================================================
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- RLS POLICIES - gamification
-- ============================================================
CREATE POLICY "Users read own gamification"
  ON public.gamification FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users update own gamification"
  ON public.gamification FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "All authenticated read gamification for ranking"
  ON public.gamification FOR SELECT
  USING (auth.role() = 'authenticated');

-- ============================================================
-- RLS POLICIES - anamnese
-- ============================================================
CREATE POLICY "Users read own anamnese"
  ON public.anamnese FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own anamnese"
  ON public.anamnese FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins read all anamnese"
  ON public.anamnese FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Especialistas read anamnese"
  ON public.anamnese FOR SELECT
  USING (public.has_role(auth.uid(), 'especialista'));

-- ============================================================
-- RLS POLICIES - workouts
-- ============================================================
CREATE POLICY "Users CRUD own workouts"
  ON public.workouts FOR ALL
  USING (auth.uid() = user_id);

-- ============================================================
-- RLS POLICIES - achievements
-- ============================================================
CREATE POLICY "Users read own achievements"
  ON public.achievements FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own achievements"
  ON public.achievements FOR INSERT
  WITH CHECK (auth.uid() = user_id);
