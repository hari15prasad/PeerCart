-- =============================================
-- PeerCart: Transactions System Migration
-- Paste into Supabase SQL Editor and Run
-- =============================================

-- 1. Transactions Table
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  final_price NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for faster queries
CREATE INDEX IF NOT EXISTS idx_transactions_buyer_id ON public.transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_seller_id ON public.transactions(seller_id);

-- 2. RLS
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see transactions where they are buyer or seller" ON public.transactions
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

CREATE POLICY "System can insert transactions" ON public.transactions
  FOR INSERT WITH CHECK (true);

-- 3. Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- 4. Updated manage_order_lifecycle with transaction insertion
CREATE OR REPLACE FUNCTION public.manage_order_lifecycle(
  target_listing_id uuid,
  target_buyer_id uuid,
  action_type text
)
RETURNS boolean AS $$
DECLARE
  v_seller_id uuid;
  v_listing_title text;
  v_listing_price numeric;
  v_buyer_name text;
  v_conv_id uuid;
BEGIN
  -- Get listing info including price
  SELECT seller_id, title, price INTO v_seller_id, v_listing_title, v_listing_price
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

    -- CREATE DIGITAL RECEIPT TRANSACTION
    INSERT INTO public.transactions (listing_id, buyer_id, seller_id, final_price)
      VALUES (target_listing_id, target_buyer_id, v_seller_id, v_listing_price);

    -- Notify buyer their deal was accepted
    INSERT INTO public.notifications (user_id, type, title, message, listing_id, conversation_id)
      VALUES (
        target_buyer_id,
        'deal_accepted',
        '🎉 Deal Accepted!',
        'Your request for "' || v_listing_title || '" was accepted. View your digital receipt in Transactions!',
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
