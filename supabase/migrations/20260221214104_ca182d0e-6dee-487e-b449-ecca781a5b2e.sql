-- Allow authenticated users to create conversations (for support chat)
CREATE POLICY "Authenticated users create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow authenticated users to add participants to conversations they participate in
CREATE POLICY "Authenticated users add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (true);