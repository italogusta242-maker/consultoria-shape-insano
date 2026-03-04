
-- Add new columns to specialist_ai_preferences
ALTER TABLE public.specialist_ai_preferences
  ADD COLUMN IF NOT EXISTS system_prompt TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS knowledge_base_pdf_path TEXT DEFAULT NULL;

-- Create ai_knowledge storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('ai-knowledge', 'ai-knowledge', false)
ON CONFLICT (id) DO NOTHING;

-- RLS: specialists can upload to their own folder
CREATE POLICY "Specialists upload own AI knowledge"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'ai-knowledge'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: specialists can read their own files
CREATE POLICY "Specialists read own AI knowledge"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'ai-knowledge'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: specialists can delete their own files
CREATE POLICY "Specialists delete own AI knowledge"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'ai-knowledge'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- RLS: specialists can update their own files
CREATE POLICY "Specialists update own AI knowledge"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'ai-knowledge'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
