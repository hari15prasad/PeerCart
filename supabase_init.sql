-- PeerCart Initial Schema
-- Paste this into your Supabase SQL Editor

-- 1. Enable UUID generating extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create Profiles Table (Tied to Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  student_year INT,
  branch TEXT,
  trust_score INT DEFAULT 0,
  karma_points INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create Listings Table
CREATE TABLE IF NOT EXISTS public.listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price INT NOT NULL,
  condition TEXT CHECK (condition IN ('New', 'Good', 'Fair')),
  image_url TEXT,
  status TEXT DEFAULT 'Available' CHECK (status IN ('Available', 'Pending', 'Sold')),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for quick feed reads
CREATE INDEX IF NOT EXISTS idx_listings_status_created ON public.listings(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);

-- 4. Create Interests Table
CREATE TABLE IF NOT EXISTS public.interests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Confirmed', 'Cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Protect against spamming the same listing
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_interest ON public.interests(listing_id, buyer_id);

-- 5. Create Demand Alerts Table
CREATE TABLE IF NOT EXISTS public.demand_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  item_keyword TEXT NOT NULL,
  category TEXT,
  max_price INT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Setup Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demand_alerts ENABLE ROW LEVEL SECURITY;

-- Profiles: Anyone can view profiles, users can update their own
CREATE POLICY "Public profiles are viewable by everyone." ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile." ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update own profile." ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Listings: Anyone can view available listings, authenticated users can create, sellers can update
CREATE POLICY "Listings are viewable by everyone." ON public.listings FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create listings." ON public.listings FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Sellers can update their own listings." ON public.listings FOR UPDATE USING (auth.uid() = seller_id);

-- Interests: Buyer and Seller can view, Buyer can create
CREATE POLICY "Buyers and Sellers can view interest." ON public.interests FOR SELECT USING (
  auth.uid() = buyer_id OR auth.uid() IN (SELECT seller_id FROM public.listings WHERE id = listing_id)
);
CREATE POLICY "Authenticated users can express interest." ON public.interests FOR INSERT WITH CHECK (auth.uid() = buyer_id);
CREATE POLICY "Stakeholders can update interest." ON public.interests FOR UPDATE USING (
  auth.uid() = buyer_id OR auth.uid() IN (SELECT seller_id FROM public.listings WHERE id = listing_id)
);

-- 7. Trigger to automatically create a profile after Supabase Auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
