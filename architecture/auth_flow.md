# Auth Flow (SOP)

## Goal
Enforce that only users with a `.edu` email address (or approved campus domain) can sign up and use the PeerCart marketplace. Ensure optimistic profile creation.

## Steps
1. **User lands on `/login`**
2. **User inputs email and requests magic link / OTP.**
3. **Frontend Validation:** Next.js route checks if `email.endsWith('.edu')`.
   - If false: Show error "Only college emails are allowed."
   - If true: Proceed to step 4.
4. **Supabase Auth Request:** Trigger `supabase.auth.signInWithOtp({ email })`.
5. **Database Trigger:** Once the user clicks the magic link and their `auth.users` record is created, a PostgreSQL Trigger (`on_auth_user_created`) automatically inserts a row into `public.profiles`.
6. **Onboarding (Optional):** If `profiles.full_name` or `branch` is null, redirect the user to `/onboarding` to complete their profile before accessing the `/` feed.

## Edge Cases
- **Non-institutional email bypass attempt:** Blocked entirely at the UI level. Supabase Auth will still technically allow it if someone hits the API directly unless we add an Auth Hook, but for MVP, frontend validation is sufficient.
- **Trigger failure:** If `public.profiles` insertion fails, the user will be logged in but won't have a profile. Next.js layout should check for profile existence and prompt them if missing.
