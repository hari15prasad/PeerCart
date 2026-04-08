-- =============================================
-- PeerCart: Intelligence & Lifecycle RPCs Only
-- Paste into Supabase SQL Editor and Run
-- The tables already exist from supabase_init.sql
-- =============================================

-- 1. RPC: get_fair_price — Historical average price for a category
CREATE OR REPLACE FUNCTION public.get_fair_price(item_category text)
RETURNS numeric AS $$
DECLARE
  avg_price numeric;
BEGIN
  SELECT AVG(price) INTO avg_price
  FROM public.listings
  WHERE category = item_category AND status = 'Sold' AND price > 0;

  RETURN COALESCE(avg_price, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. RPC: get_demand_count — Count active searchers matching an item
CREATE OR REPLACE FUNCTION public.get_demand_count(item_category text, item_title text)
RETURNS int AS $$
DECLARE
  demand_count int;
BEGIN
  SELECT COUNT(DISTINCT user_id) INTO demand_count
  FROM public.demand_alerts
  WHERE is_active = true
    AND (
      category = item_category
      OR item_keyword ILIKE '%' || item_title || '%'
    );

  RETURN demand_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. RPC: manage_order_lifecycle — Atomic transaction state machine
CREATE OR REPLACE FUNCTION public.manage_order_lifecycle(
  target_listing_id uuid,
  target_buyer_id uuid,
  action_type text
)
RETURNS boolean AS $$
BEGIN
  -- BUYER STARTS PURCHASE → listing becomes Pending
  IF action_type = 'START_PURCHASE' THEN
    UPDATE public.listings
      SET status = 'Pending'
      WHERE id = target_listing_id AND status = 'Available';
    IF NOT FOUND THEN RETURN false; END IF;

    -- Upsert the interest record
    INSERT INTO public.interests (listing_id, buyer_id, status)
      VALUES (target_listing_id, target_buyer_id, 'Pending')
      ON CONFLICT (listing_id, buyer_id) DO UPDATE SET status = 'Pending';
    RETURN true;

  -- SELLER CONFIRMS → listing becomes Sold
  ELSIF action_type = 'CONFIRM_SALE' THEN
    UPDATE public.listings
      SET status = 'Sold'
      WHERE id = target_listing_id AND status = 'Pending';
    IF NOT FOUND THEN RETURN false; END IF;

    UPDATE public.interests
      SET status = 'Confirmed'
      WHERE listing_id = target_listing_id AND buyer_id = target_buyer_id;

    -- Cancel all other competing interests
    UPDATE public.interests
      SET status = 'Cancelled'
      WHERE listing_id = target_listing_id AND buyer_id != target_buyer_id;
    RETURN true;

  -- BUYER CANCELS or SELLER REJECTS → listing back to Available
  ELSIF action_type IN ('CANCEL_PURCHASE', 'REJECT_SALE') THEN
    UPDATE public.listings
      SET status = 'Available'
      WHERE id = target_listing_id AND status = 'Pending';

    UPDATE public.interests
      SET status = 'Cancelled'
      WHERE listing_id = target_listing_id AND buyer_id = target_buyer_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Also grant the demand_alerts RLS policies if not already set
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'demand_alerts' AND policyname = 'Users insert own demand alerts'
  ) THEN
    EXECUTE 'CREATE POLICY "Users insert own demand alerts" ON public.demand_alerts FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'CREATE POLICY "Users read own demand alerts" ON public.demand_alerts FOR SELECT USING (auth.uid() = user_id)';
  END IF;
END $$;
