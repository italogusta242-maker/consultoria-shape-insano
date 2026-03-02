-- Add reviewed tracking to anamnese
ALTER TABLE public.anamnese
ADD COLUMN reviewed boolean NOT NULL DEFAULT false,
ADD COLUMN reviewed_by uuid DEFAULT NULL,
ADD COLUMN reviewed_at timestamptz DEFAULT NULL;

-- Allow specialists to update anamnese (mark as reviewed)
CREATE POLICY "Especialistas update anamnese reviewed"
ON public.anamnese
FOR UPDATE
USING (public.has_role(auth.uid(), 'especialista'))
WITH CHECK (public.has_role(auth.uid(), 'especialista'));

-- Allow admins to update anamnese
CREATE POLICY "Admins update anamnese"
ON public.anamnese
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Allow specialists to manage exercise library (create/edit exercises with YouTube links)
CREATE POLICY "Especialistas manage exercises"
ON public.exercise_library
FOR ALL
USING (public.has_role(auth.uid(), 'especialista'))
WITH CHECK (public.has_role(auth.uid(), 'especialista'));

-- Allow admins to manage exercise library
CREATE POLICY "Admins manage exercises"
ON public.exercise_library
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));