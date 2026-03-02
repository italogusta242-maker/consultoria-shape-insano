
-- Create chat-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true);

-- Allow authenticated users to upload to chat-media
CREATE POLICY "Authenticated users upload chat media"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-media' AND auth.role() = 'authenticated');

-- Allow anyone to view chat media (public bucket)
CREATE POLICY "Public read chat media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-media');

-- Allow users to delete their own uploads
CREATE POLICY "Users delete own chat media"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'chat-media' AND auth.uid()::text = (storage.foldername(name))[1]);
