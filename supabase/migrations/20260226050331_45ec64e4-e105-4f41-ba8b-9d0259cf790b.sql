
-- Create storage bucket for blood test PDFs
INSERT INTO storage.buckets (id, name, public) VALUES ('exames-sangue', 'exames-sangue', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can upload their own blood tests
CREATE POLICY "Users upload own blood tests"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'exames-sangue' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Users can view their own blood tests
CREATE POLICY "Users view own blood tests"
ON storage.objects FOR SELECT
USING (bucket_id = 'exames-sangue' AND auth.uid()::text = (storage.foldername(name))[1]);

-- RLS: Admins can view all blood tests
CREATE POLICY "Admins view all blood tests"
ON storage.objects FOR SELECT
USING (bucket_id = 'exames-sangue' AND public.has_role(auth.uid(), 'admin'));

-- RLS: Specialists can view assigned student blood tests
CREATE POLICY "Specialists view student blood tests"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'exames-sangue' 
  AND EXISTS (
    SELECT 1 FROM public.student_specialists ss 
    WHERE ss.specialist_id = auth.uid() 
    AND ss.student_id::text = (storage.foldername(name))[1]
  )
);
