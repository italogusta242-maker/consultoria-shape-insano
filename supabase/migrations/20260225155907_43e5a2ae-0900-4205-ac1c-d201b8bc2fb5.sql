
INSERT INTO storage.buckets (id, name, public) VALUES ('temp-imports', 'temp-imports', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read temp-imports" ON storage.objects FOR SELECT USING (bucket_id = 'temp-imports');
CREATE POLICY "Auth upload temp-imports" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'temp-imports' AND auth.role() = 'authenticated');
