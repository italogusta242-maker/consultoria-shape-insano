ALTER TABLE public.dismissed_alerts
  ADD COLUMN IF NOT EXISTS trainer_alert_status text NOT NULL DEFAULT 'dismissed',
  ADD COLUMN IF NOT EXISTS trainer_alert_reason text,
  ADD COLUMN IF NOT EXISTS trainer_alert_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_dismissed_alerts_status ON public.dismissed_alerts(specialist_id, trainer_alert_status);