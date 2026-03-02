-- Allow closers to manage subscription_plans
CREATE POLICY "Closers manage subscription_plans"
ON public.subscription_plans
FOR ALL
USING (has_role(auth.uid(), 'closer'::app_role))
WITH CHECK (has_role(auth.uid(), 'closer'::app_role));