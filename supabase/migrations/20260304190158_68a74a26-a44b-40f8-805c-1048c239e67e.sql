
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- Create knowledge base table for RAG embeddings
CREATE TABLE public.ai_knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  specialist_id UUID NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  embedding extensions.vector(768),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index for fast similarity search
CREATE INDEX ai_knowledge_base_embedding_idx 
  ON public.ai_knowledge_base 
  USING ivfflat (embedding extensions.vector_cosine_ops)
  WITH (lists = 100);

-- Create index for specialist filtering
CREATE INDEX ai_knowledge_base_specialist_idx 
  ON public.ai_knowledge_base (specialist_id);

-- Enable RLS
ALTER TABLE public.ai_knowledge_base ENABLE ROW LEVEL SECURITY;

-- RLS: specialists manage their own knowledge base
CREATE POLICY "Specialists manage own knowledge base"
  ON public.ai_knowledge_base
  FOR ALL
  TO authenticated
  USING (auth.uid() = specialist_id)
  WITH CHECK (auth.uid() = specialist_id);

-- Match documents function for similarity search
CREATE OR REPLACE FUNCTION public.match_documents(
  query_embedding extensions.vector(768),
  match_count INT DEFAULT 5,
  match_threshold FLOAT DEFAULT 0.7,
  filter_specialist_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kb.id,
    kb.content,
    kb.metadata,
    1 - (kb.embedding <=> query_embedding)::FLOAT AS similarity
  FROM public.ai_knowledge_base kb
  WHERE 
    (filter_specialist_id IS NULL OR kb.specialist_id = filter_specialist_id)
    AND 1 - (kb.embedding <=> query_embedding)::FLOAT > match_threshold
  ORDER BY kb.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
