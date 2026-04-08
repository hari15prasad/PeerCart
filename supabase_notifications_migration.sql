-- =============================================
-- PeerCart: Notifications System Migration
-- Paste into Supabase SQL Editor and Run
-- =============================================

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL, -- 'new_request', 'deal_accepted', 'deal_rejected', 'deal_cancelled'
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON public.notifications(user_id, is_read);

-- 2. RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can mark own notifications as read" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- 4. Updated manage_order_lifecycle with notification inserts
-- This replaces the existing function
CREATE OR REPLACE FUNCTION public.manage_order_lifecycle(
  target_listing_id uuid,
  target_buyer_id uuid,
  action_type text
)
RETURNS boolean AS $$
DECLARE
  v_seller_id uuid;
  v_listing_title text;
  v_buyer_name text;
  v_conv_id uuid;
BEGIN
  -- Get listing info
  SELECT seller_id, title INTO v_seller_id, v_listing_title
  FROM public.listings WHERE id = target_listing_id;

  -- Get buyer name
  SELECT COALESCE(full_name, email) INTO v_buyer_name
  FROM public.profiles WHERE id = target_buyer_id;

  -- Get conversation id if exists
  SELECT id INTO v_conv_id FROM public.conversations
  WHERE listing_id = target_listing_id AND buyer_id = target_buyer_id
  LIMIT 1;

  -- BUYER STARTS PURCHASE → listing becomes Pending
  IF action_type = 'START_PURCHASE' THEN
    UPDATE public.listings
      SET status = 'Pending'
      WHERE id = target_listing_id AND status = 'Available';
    IF NOT FOUND THEN RETURN false; END IF;

    INSERT INTO public.interests (listing_id, buyer_id, status)
      VALUES (target_listing_id, target_buyer_id, 'Pending')
      ON CONFLICT (listing_id, buyer_id) DO UPDATE SET status = 'Pending';

    -- Notify seller about new request
    INSERT INTO public.notifications (user_id, type, title, message, listing_id, conversation_id)
      VALUES (
        v_seller_id,
        'new_request',
        '🛎️ New Deal Request',
        v_buyer_name || ' wants to buy your "' || v_listing_title || '"',
        target_listing_id,
        v_conv_id
      );
    RETURN true;

  -- SELLER CONFIRMS → listing becomes Sold
  ELSIF action_type = 'CONFIRM_SALE' THEN
    UPDATE public.listings
      SET status = 'Sold'
      WHERE id = target_listing_id AND status = 'Pending';
    IF NOT FOUND THEN RETURN false; END IF;

    UPDATE public.interests SET status = 'Confirmed'
      WHERE listing_id = target_listing_id AND buyer_id = target_buyer_id;

    UPDATE public.interests SET status = 'Cancelled'
      WHERE listing_id = target_listing_id AND buyer_id != target_buyer_id;

    -- Notify buyer their deal was accepted
    INSERT INTO public.notifications (user_id, type, title, message, listing_id, conversation_id)
      VALUES (
        target_buyer_id,
        'deal_accepted',
        '🎉 Deal Accepted!',
        'Your request for "' || v_listing_title || '" was accepted. Go chat to finalize meetup!',
        target_listing_id,
        v_conv_id
      );
    RETURN true;

  -- SELLER REJECTS → listing back to Available
  ELSIF action_type = 'REJECT_SALE' THEN
    UPDATE public.listings SET status = 'Available'
      WHERE id = target_listing_id AND status = 'Pending';

    UPDATE public.interests SET status = 'Cancelled'
      WHERE listing_id = target_listing_id AND buyer_id = target_buyer_id;

    -- Notify buyer their request was rejected
    INSERT INTO public.notifications (user_id, type, title, message, listing_id)
      VALUES (
        target_buyer_id,
        'deal_rejected',
        '❌ Request Declined',
        'Your request for "' || v_listing_title || '" was declined by the seller. Keep looking!',
        target_listing_id
      );
    RETURN true;

  -- BUYER CANCELS → listing back to Available
  ELSIF action_type = 'CANCEL_PURCHASE' THEN
    UPDATE public.listings SET status = 'Available'
      WHERE id = target_listing_id AND status = 'Pending';

    UPDATE public.interests SET status = 'Cancelled'
      WHERE listing_id = target_listing_id AND buyer_id = target_buyer_id;

    -- Notify seller the buyer cancelled
    INSERT INTO public.notifications (user_id, type, title, message, listing_id)
      VALUES (
        v_seller_id,
        'deal_cancelled',
        '↩️ Request Cancelled',
        v_buyer_name || ' cancelled their request for "' || v_listing_title || '"',
        target_listing_id
      );
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
