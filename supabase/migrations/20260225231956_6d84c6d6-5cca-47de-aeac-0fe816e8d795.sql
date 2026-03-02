
-- Create flame_status table for persistent flame state
CREATE TABLE public.flame_status (
  user_id UUID NOT NULL PRIMARY KEY,
  state TEXT NOT NULL DEFAULT 'normal' CHECK (state IN ('normal', 'ativa', 'tregua', 'extinta')),
  streak INTEGER NOT NULL DEFAULT 0,
  last_approved_date DATE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.flame_status ENABLE ROW LEVEL SECURITY;

-- Users read own flame status
CREATE POLICY "Users read own flame status"
ON public.flame_status FOR SELECT
USING (auth.uid() = user_id);

-- Users upsert own flame status (for immediate motor)
CREATE POLICY "Users upsert own flame status"
ON public.flame_status FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own flame status"
ON public.flame_status FOR UPDATE
USING (auth.uid() = user_id);

-- Admins read all
CREATE POLICY "Admins read all flame status"
ON public.flame_status FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Especialistas read assigned students
CREATE POLICY "Especialistas read student flame status"
ON public.flame_status FOR SELECT
USING (EXISTS (
  SELECT 1 FROM student_specialists ss
  WHERE ss.specialist_id = auth.uid() AND ss.student_id = flame_status.user_id
));

-- Service role full access (for cron edge function)
CREATE POLICY "Service role manage flame status"
ON public.flame_status FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for immediate UI updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.flame_status;
