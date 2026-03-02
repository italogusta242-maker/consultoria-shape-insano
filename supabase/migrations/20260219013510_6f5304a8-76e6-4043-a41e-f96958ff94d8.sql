
-- Table to link students to specialists
CREATE TABLE public.student_specialists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL,
  specialist_id UUID NOT NULL,
  specialty TEXT NOT NULL CHECK (specialty IN ('preparador', 'nutricionista', 'psicologo')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(student_id, specialist_id)
);

ALTER TABLE public.student_specialists ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Students see own specialists"
ON public.student_specialists FOR SELECT
USING (auth.uid() = student_id);

CREATE POLICY "Specialists see own students"
ON public.student_specialists FOR SELECT
USING (auth.uid() = specialist_id);

CREATE POLICY "Admins manage student_specialists"
ON public.student_specialists FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Specialists manage own links"
ON public.student_specialists FOR ALL
USING (public.has_role(auth.uid(), 'especialista'));

-- Function: auto-create conversations when linking student to specialist
CREATE OR REPLACE FUNCTION public.auto_create_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id UUID;
  group_conv_id UUID;
  existing_group UUID;
BEGIN
  -- 1. Create direct conversation between student and specialist
  INSERT INTO public.conversations (type, title)
  VALUES ('direct', NULL)
  RETURNING id INTO conv_id;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (conv_id, NEW.student_id), (conv_id, NEW.specialist_id);

  -- 2. Check if group conversation already exists for this student
  SELECT c.id INTO existing_group
  FROM public.conversations c
  JOIN public.conversation_participants cp ON cp.conversation_id = c.id
  WHERE c.type = 'group'
    AND cp.user_id = NEW.student_id
  LIMIT 1;

  IF existing_group IS NULL THEN
    -- Create group conversation
    INSERT INTO public.conversations (type, title)
    VALUES ('group', 'Equipe Multidisciplinar')
    RETURNING id INTO group_conv_id;

    -- Add student
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (group_conv_id, NEW.student_id);

    -- Add specialist
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (group_conv_id, NEW.specialist_id);
  ELSE
    -- Add specialist to existing group if not already there
    INSERT INTO public.conversation_participants (conversation_id, user_id)
    VALUES (existing_group, NEW.specialist_id)
    ON CONFLICT (conversation_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger
CREATE TRIGGER on_student_specialist_link
AFTER INSERT ON public.student_specialists
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_conversations();

-- Index
CREATE INDEX idx_student_specialists_student ON public.student_specialists(student_id);
CREATE INDEX idx_student_specialists_specialist ON public.student_specialists(specialist_id);
