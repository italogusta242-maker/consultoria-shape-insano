
-- Add reply_to column for quote/reply feature
ALTER TABLE public.chat_messages ADD COLUMN reply_to UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_chat_messages_reply_to ON public.chat_messages(reply_to);
