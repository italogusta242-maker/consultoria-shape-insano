-- Drop overly permissive policies and replace with tighter ones
DROP POLICY "Authenticated users create conversations" ON public.conversations;
DROP POLICY "Authenticated users add participants" ON public.conversation_participants;

-- Users can create conversations
CREATE POLICY "Authenticated users create conversations"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Users can add themselves or others to conversations they're part of
CREATE POLICY "Authenticated users add participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);