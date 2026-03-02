
-- ============================================================
-- CRITICAL FIX 1: Especialistas só veem perfis dos seus alunos
-- ============================================================

-- Drop old overly permissive policies
DROP POLICY IF EXISTS "Especialistas read profiles" ON public.profiles;

-- Especialistas só veem perfis de alunos atribuídos a eles
CREATE POLICY "Especialistas read assigned student profiles"
ON public.profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = profiles.id
  )
);

-- ============================================================
-- CRITICAL FIX 2: Especialistas só veem anamnese dos seus alunos
-- ============================================================

DROP POLICY IF EXISTS "Especialistas read anamnese" ON public.anamnese;
DROP POLICY IF EXISTS "Especialistas update anamnese reviewed" ON public.anamnese;

CREATE POLICY "Especialistas read assigned student anamnese"
ON public.anamnese
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = anamnese.user_id
  )
);

CREATE POLICY "Especialistas update assigned student anamnese"
ON public.anamnese
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = anamnese.user_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = anamnese.user_id
  )
);

-- ============================================================
-- CRITICAL FIX 3: Especialistas só veem avaliações dos seus alunos
-- ============================================================

DROP POLICY IF EXISTS "Especialistas read monthly assessments" ON public.monthly_assessments;

CREATE POLICY "Especialistas read assigned student assessments"
ON public.monthly_assessments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = monthly_assessments.user_id
  )
);

-- ============================================================
-- CRITICAL FIX 4: Closers só veem convites que eles criaram
-- ============================================================

DROP POLICY IF EXISTS "Closers manage own invites" ON public.invites;

CREATE POLICY "Closers manage own created invites"
ON public.invites
FOR ALL
USING (
  has_role(auth.uid(), 'closer'::app_role)
  AND created_by = auth.uid()
)
WITH CHECK (
  has_role(auth.uid(), 'closer'::app_role)
  AND created_by = auth.uid()
);

-- ============================================================
-- MEDIUM FIX 1: Especialistas só veem check-ins dos seus alunos
-- ============================================================

DROP POLICY IF EXISTS "Especialistas read checkins" ON public.psych_checkins;

CREATE POLICY "Especialistas read assigned student checkins"
ON public.psych_checkins
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = psych_checkins.user_id
  )
);

-- ============================================================
-- MEDIUM FIX 2: Especialistas só veem hábitos dos seus alunos
-- ============================================================

DROP POLICY IF EXISTS "Especialistas read daily habits" ON public.daily_habits;

CREATE POLICY "Especialistas read assigned student daily habits"
ON public.daily_habits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = daily_habits.user_id
  )
);

-- ============================================================
-- MEDIUM FIX 3: Especialistas podem ver treinos dos seus alunos
-- ============================================================

CREATE POLICY "Especialistas read assigned student workouts"
ON public.workouts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.student_specialists ss
    WHERE ss.specialist_id = auth.uid()
      AND ss.student_id = workouts.user_id
  )
);

-- ============================================================
-- MEDIUM FIX 4: app_settings com allowlist (mais seguro)
-- ============================================================

DROP POLICY IF EXISTS "Authenticated read non-secret app_settings" ON public.app_settings;

CREATE POLICY "Authenticated read public app_settings"
ON public.app_settings
FOR SELECT
USING (
  (auth.role() = 'authenticated'::text)
  AND key IN ('supabase_url', 'supabase_anon_key', 'app_name', 'app_version')
);

-- ============================================================
-- INFO FIX: Users can delete own notifications
-- ============================================================

CREATE POLICY "Users delete own notifications"
ON public.notifications
FOR DELETE
USING (auth.uid() = user_id);
