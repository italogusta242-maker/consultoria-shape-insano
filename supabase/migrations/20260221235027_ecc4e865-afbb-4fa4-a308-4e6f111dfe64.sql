
-- 1. Subscriptions table
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  started_at timestamptz NOT NULL DEFAULT now(),
  canceled_at timestamptz,
  cancel_reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "CS read all subscriptions"
  ON public.subscriptions FOR SELECT
  USING (public.has_role(auth.uid(), 'cs'));

CREATE POLICY "Users read own subscription"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins manage subscriptions"
  ON public.subscriptions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Marketing spend table
CREATE TABLE public.marketing_spend (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month date NOT NULL,
  channel text NOT NULL DEFAULT 'ads',
  amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.marketing_spend ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage marketing_spend"
  ON public.marketing_spend FOR ALL
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Seed subscriptions from existing used invites
INSERT INTO public.subscriptions (user_id, plan_price, status, started_at)
SELECT p.id, COALESCE(i.plan_value, 0), 'active', COALESCE(i.used_at, p.created_at)
FROM public.profiles p
LEFT JOIN public.invites i ON i.email = p.email AND i.status = 'used'
WHERE p.status != 'pendente_onboarding'
  AND NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = p.id);
