-- =============================================
-- PeerCart Publisher: Leaderboard Architecture
-- Paste into Supabase SQL Editor and Run
-- =============================================

-- 1. Create a dynamic Postgres View for weekly gamification stats
-- This automatically aggregates scores without requiring costly frontend queries
CREATE OR REPLACE VIEW public.weekly_leaderboard_stats AS
SELECT 
  p.id AS user_id,
  COALESCE(p.full_name, p.email) AS display_name,
  
  -- Declutter Pro: Total listings created this week
  COUNT(l.id) AS declutter_score,
  
  -- Seller Score: Total sales amount (only for Sold items with price > 0)
  COALESCE(SUM(l.price) FILTER (WHERE l.status = 'Sold' AND l.price > 0), 0) AS seller_score,
  
  -- Campus Helper: Total successful transactions (Sold items)
  COUNT(l.id) FILTER (WHERE l.status = 'Sold') AS helper_score,
  
  -- Eco Score: (Items sold * 2) + (Items donated [price=0] * 3)
  (COUNT(l.id) FILTER (WHERE l.status = 'Sold' AND l.price > 0) * 2) +
  (COUNT(l.id) FILTER (WHERE l.status = 'Sold' AND l.price = 0) * 3) AS eco_score,
  
  -- Speed Demon / Responder approximation (Total conversations active)
  -- This is a lightweight proxy placeholder. Will be updated if strict timestamp delta is requested.
  (SELECT COUNT(*) FROM public.conversations c WHERE c.seller_id = p.id) AS responder_score

FROM public.profiles p
LEFT JOIN public.listings l 
  ON p.id = l.seller_id 
  AND l.created_at >= date_trunc('week', now())
GROUP BY p.id;

-- 2. Create RPC function for secure Top N fetching
-- This allows the frontend to call supabase.rpc('get_leaderboard', { category: 'eco_score', limit_val: 10 })
CREATE OR REPLACE FUNCTION public.get_leaderboard(category text, limit_val int DEFAULT 10)
RETURNS TABLE (
  user_id UUID,
  display_name TEXT,
  score BIGINT
) AS $$
BEGIN
  RETURN QUERY EXECUTE format('
    SELECT user_id, display_name, %I::BIGINT AS score 
    FROM public.weekly_leaderboard_stats 
    WHERE %I > 0
    ORDER BY %I DESC 
    LIMIT %L', 
    category, category, category, limit_val
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
