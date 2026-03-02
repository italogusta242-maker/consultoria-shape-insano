
-- Create storage bucket for anamnese photos
INSERT INTO storage.buckets (id, name, public) VALUES ('anamnese-photos', 'anamnese-photos', true);

-- Users can upload their own photos
CREATE POLICY "Users upload own anamnese photos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'anamnese-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Anyone authenticated can view photos (specialists need access too)
CREATE POLICY "Authenticated users view anamnese photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'anamnese-photos' AND auth.role() = 'authenticated');

-- Users can update their own photos
CREATE POLICY "Users update own anamnese photos"
ON storage.objects FOR UPDATE
USING (bucket_id = 'anamnese-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
