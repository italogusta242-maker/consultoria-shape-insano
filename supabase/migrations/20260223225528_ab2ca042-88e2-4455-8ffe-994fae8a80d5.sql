
-- Allow personal trainers to manage exercise_library
CREATE POLICY "Personal manage exercises"
ON public.exercise_library
FOR ALL
USING (has_role(auth.uid(), 'personal'::app_role))
WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

-- Allow personal trainers to manage training_plans
CREATE POLICY "Personal manage training plans"
ON public.training_plans
FOR ALL
USING (has_role(auth.uid(), 'personal'::app_role))
WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

-- Allow nutricionistas to manage diet_plans (they likely need this too)
CREATE POLICY "Nutricionista manage diet plans"
ON public.diet_plans
FOR ALL
USING (has_role(auth.uid(), 'nutricionista'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutricionista'::app_role));

-- Allow personal to read all training plans (admin-like for their students)
CREATE POLICY "Personal read all training plans"
ON public.training_plans
FOR SELECT
USING (has_role(auth.uid(), 'personal'::app_role));

-- Allow personal and nutricionista to manage training/diet templates
CREATE POLICY "Personal manage training templates"
ON public.training_templates
FOR ALL
USING (has_role(auth.uid(), 'personal'::app_role))
WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

CREATE POLICY "Nutricionista manage diet templates"
ON public.diet_templates
FOR ALL
USING (has_role(auth.uid(), 'nutricionista'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutricionista'::app_role));

-- Allow personal/nutricionista to read assigned student profiles
CREATE POLICY "Personal read assigned student profiles"
ON public.profiles
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = profiles.id
));

-- Allow personal/nutricionista to read student data they need
CREATE POLICY "Personal read assigned student anamnese"
ON public.anamnese
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = anamnese.user_id
));

CREATE POLICY "Personal read assigned student workouts"
ON public.workouts
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = workouts.user_id
));

CREATE POLICY "Personal read assigned student assessments"
ON public.monthly_assessments
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = monthly_assessments.user_id
));

CREATE POLICY "Personal read assigned student daily habits"
ON public.daily_habits
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = daily_habits.user_id
));

CREATE POLICY "Personal read assigned student checkins"
ON public.psych_checkins
FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = psych_checkins.user_id
));

-- Allow personal/nutricionista to manage student_specialists
CREATE POLICY "Personal manage student links"
ON public.student_specialists
FOR ALL
USING (has_role(auth.uid(), 'personal'::app_role))
WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

CREATE POLICY "Nutricionista manage student links"
ON public.student_specialists
FOR ALL
USING (has_role(auth.uid(), 'nutricionista'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutricionista'::app_role));

-- Allow personal to manage volume_limits
CREATE POLICY "Personal manage volume limits"
ON public.volume_limits
FOR ALL
USING (has_role(auth.uid(), 'personal'::app_role))
WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

-- Allow personal/nutricionista to manage food_database
CREATE POLICY "Personal manage food database"
ON public.food_database
FOR ALL
USING (has_role(auth.uid(), 'personal'::app_role))
WITH CHECK (has_role(auth.uid(), 'personal'::app_role));

CREATE POLICY "Nutricionista manage food database"
ON public.food_database
FOR ALL
USING (has_role(auth.uid(), 'nutricionista'::app_role))
WITH CHECK (has_role(auth.uid(), 'nutricionista'::app_role));
