-- =============================================
-- PeerCart Reviews & Ratings Migration
-- Paste into Supabase SQL Editor and Run
-- =============================================

-- 1. Create Reviews Table
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  reviewee_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  -- Prevent a user from reviewing the same transaction multiple times
  UNIQUE(listing_id, reviewer_id, reviewee_id)
);

-- 2. Enable Row Level Security
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 3. RLS Policies
CREATE POLICY "Reviews are viewable by everyone." 
  ON public.reviews FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create reviews." 
  ON public.reviews FOR INSERT 
  WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update their own reviews." 
  ON public.reviews FOR UPDATE 
  USING (auth.uid() = reviewer_id);

-- 4. Trust Score Calculation Trigger
-- This dynamically calculates the Trust Score (0-100) whenever a review is inserted.
-- Averages all ratings for the reviewee, multiplies by 20 (e.g. 5 stars = 100).
CREATE OR REPLACE FUNCTION public.update_trust_score()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET trust_score = (
    SELECT COALESCE(AVG(rating) * 20, 0)::INT
    FROM public.reviews
    WHERE reviewee_id = NEW.reviewee_id
  )
  WHERE id = NEW.reviewee_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Attach the trigger to the reviews table
DROP TRIGGER IF EXISTS on_review_created ON public.reviews;

CREATE TRIGGER on_review_created
  AFTER INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_trust_score();
