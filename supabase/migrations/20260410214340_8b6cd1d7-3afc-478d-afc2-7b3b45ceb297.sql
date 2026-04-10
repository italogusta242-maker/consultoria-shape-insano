
CREATE TABLE public.dismissed_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL,
  alert_key TEXT NOT NULL,
  student_id UUID NOT NULL,
  dismissed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(specialist_id, alert_key)
);

ALTER TABLE public.dismissed_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Specialists manage own dismissed alerts"
ON public.dismissed_alerts
FOR ALL
TO authenticated
USING (auth.uid() = specialist_id)
WITH CHECK (auth.uid() = specialist_id);

CREATE INDEX idx_dismissed_alerts_specialist ON public.dismissed_alerts(specialist_id);
