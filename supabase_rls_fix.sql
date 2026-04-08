-- =============================================
-- PeerCart RLS Fix + Storage Policies
-- Paste this into Supabase SQL Editor and Run
-- =============================================

-- 1. Fix listings INSERT policy (old auth.role() syntax is deprecated)
DROP POLICY IF EXISTS "Authenticated users can create listings." ON public.listings;
CREATE POLICY "Authenticated users can create listings." ON public.listings
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = seller_id);

-- 2. Fix listings DELETE (sellers can delete own)
DROP POLICY IF EXISTS "Sellers can delete their own listings." ON public.listings;
CREATE POLICY "Sellers can delete their own listings." ON public.listings
  FOR DELETE USING (auth.uid() = seller_id);

-- 3. Ensure profiles trigger handles Google OAuth users too
-- (Google users might not have a profile row yet)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Allow authenticated users to upload to storage (listings bucket)
DROP POLICY IF EXISTS "Authenticated users can upload listing images." ON storage.objects;
CREATE POLICY "Authenticated users can upload listing images."
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'listings' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Listing images are publicly viewable." ON storage.objects;
CREATE POLICY "Listing images are publicly viewable."
  ON storage.objects FOR SELECT
  USING (bucket_id = 'listings');

DROP POLICY IF EXISTS "Users can delete their own images." ON storage.objects;
CREATE POLICY "Users can delete their own images."
  ON storage.objects FOR DELETE
  USING (bucket_id = 'listings' AND auth.uid()::text = (storage.foldername(name))[1]);
