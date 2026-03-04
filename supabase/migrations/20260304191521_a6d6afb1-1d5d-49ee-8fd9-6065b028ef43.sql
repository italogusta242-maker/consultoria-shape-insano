
CREATE TABLE public.ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id uuid NOT NULL,
  student_id uuid NOT NULL,
  prompt_context text,
  generated_content jsonb NOT NULL DEFAULT '{}'::jsonb,
  latency_ms integer,
  feedback varchar(10) CHECK (feedback IN ('like', 'dislike')),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists manage own logs"
  ON public.ai_generation_logs FOR ALL
  USING (auth.uid() = specialist_id)
  WITH CHECK (auth.uid() = specialist_id);

CREATE POLICY "Service role insert logs"
  ON public.ai_generation_logs FOR INSERT
  WITH CHECK (true);

CREATE INDEX idx_ai_gen_logs_specialist_feedback 
  ON public.ai_generation_logs (specialist_id, feedback, created_at DESC);
