-- =============================================
-- PeerCart Chat System Migration
-- Paste into Supabase SQL Editor and Run
-- =============================================

-- 1. Conversations table (one per listing+buyer pair)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(listing_id, buyer_id)
);

-- 2. Messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT,
  file_url TEXT,
  file_type TEXT CHECK (file_type IN ('image', 'audio', 'file')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Conversation policies
CREATE POLICY "Participants can view conversations." ON public.conversations
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "Buyers can create conversations." ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- 5. Message policies
CREATE POLICY "Participants can view messages." ON public.messages
  FOR SELECT USING (
    auth.uid() IN (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)
    OR auth.uid() IN (SELECT seller_id FROM public.conversations WHERE id = conversation_id)
  );

CREATE POLICY "Participants can send messages." ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND (
      auth.uid() IN (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)
      OR auth.uid() IN (SELECT seller_id FROM public.conversations WHERE id = conversation_id)
    )
  );

-- 6. Enable Realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- 7. Storage policies for chat-files bucket
DROP POLICY IF EXISTS "Chat participants can upload files." ON storage.objects;
CREATE POLICY "Chat participants can upload files."
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Chat files are viewable by authenticated users." ON storage.objects;
CREATE POLICY "Chat files are viewable by authenticated users."
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');
