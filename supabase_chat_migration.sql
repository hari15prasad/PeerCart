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
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Add unread count and latest message tracking to conversations
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS unread_count_buyer INT DEFAULT 0;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS unread_count_seller INT DEFAULT 0;

-- 4. Trigger to handle unread counts on messsage insert
CREATE OR REPLACE FUNCTION public.handle_message_unread()
RETURNS TRIGGER AS $$
DECLARE
  v_buyer_id UUID;
  v_seller_id UUID;
BEGIN
  -- Get participant ids
  SELECT buyer_id, seller_id INTO v_buyer_id, v_seller_id
  FROM public.conversations WHERE id = NEW.conversation_id;

  -- Update last message timestamp
  UPDATE public.conversations SET last_message_at = NOW() WHERE id = NEW.conversation_id;

  -- Increment unread count for the recipient
  IF NEW.sender_id = v_buyer_id THEN
    UPDATE public.conversations SET unread_count_seller = unread_count_seller + 1 WHERE id = NEW.conversation_id;
  ELSE
    UPDATE public.conversations SET unread_count_buyer = unread_count_buyer + 1 WHERE id = NEW.conversation_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_message_inserted
  AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.handle_message_unread();


-- 5. Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 6. Conversation policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view conversations.' AND tablename = 'conversations') THEN
        CREATE POLICY "Participants can view conversations." ON public.conversations
          FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Buyers can create conversations.' AND tablename = 'conversations') THEN
        CREATE POLICY "Buyers can create conversations." ON public.conversations
          FOR INSERT WITH CHECK (auth.uid() = buyer_id);
    END IF;
END $$;

-- 7. Message policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can view messages.' AND tablename = 'messages') THEN
        CREATE POLICY "Participants can view messages." ON public.messages
          FOR SELECT USING (
            auth.uid() IN (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)
            OR auth.uid() IN (SELECT seller_id FROM public.conversations WHERE id = conversation_id)
          );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can send messages.' AND tablename = 'messages') THEN
        CREATE POLICY "Participants can send messages." ON public.messages
          FOR INSERT WITH CHECK (
            auth.uid() = sender_id AND (
              auth.uid() IN (SELECT buyer_id FROM public.conversations WHERE id = conversation_id)
              OR auth.uid() IN (SELECT seller_id FROM public.conversations WHERE id = conversation_id)
            )
          );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Participants can update their own messages.' AND tablename = 'messages') THEN
        CREATE POLICY "Participants can update their own messages." ON public.messages
          FOR UPDATE USING (auth.uid() = sender_id)
          WITH CHECK (auth.uid() = sender_id);
    END IF;
END $$;

-- 8. Enable Realtime
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'messages') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'conversations') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
    END IF;
END $$;

-- 9. Storage policies for chat-files bucket
DROP POLICY IF EXISTS "Chat participants can upload files." ON storage.objects;
CREATE POLICY "Chat participants can upload files."
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'chat-files' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Chat files are viewable by authenticated users." ON storage.objects;
CREATE POLICY "Chat files are viewable by authenticated users."
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-files' AND auth.role() = 'authenticated');
