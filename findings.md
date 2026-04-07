# 🔍 PeerCart — Findings & Research

> This file captures all research, discoveries, constraints, and external learnings.

---

## Discovery Phase Answers
1. **North Star:** Reduce the time-to-list for students to under 60 seconds via AI automation.
2. **Integrations:** Supabase (Auth/DB/Storage), OpenAI API (gpt-4o-mini), Vercel, PostHog.
3. **Source of Truth:** Supabase PostgreSQL (denormalized strategy).
4. **Delivery Payload:** Next.js PWA / Web App deployed to Vercel.
5. **Behavioral Rules:** No payment processing (offline only), College email login only.

## Hackathon "X-Factor" Ideas to Outstand the Competition

Since 6 other teams are building the same core functionality, you need unique "hooks" that judges will remember. The primary goal is to demonstrate **hyper-locality**, **reliability**, and **frictionless UX**.

### 1. "Campus Hotspots" Map Integration (Reliability & Safety)
- **Idea:** Instead of just "meetup offline", let sellers select predefined safe campus locations (e.g., "Library Cafe", "Block B Atrium", "Main Gate") from a dropdown when listing. 
- **Why it wins:** Shows you've thought about physical safety and the messy reality of offline meetups. It bridges the digital and physical campus.

### 2. WhatsApp Auto-Bumper Bot (Frictionless UX & Adoption)
- **Idea:** Students are already in WhatsApp groups. Build a simple WhatsApp bot where a user can forward a message ("Selling my book...", including a photo) to the bot, and it automatically parses it using OpenAI and creates a draft listing on their PeerCart account.
- **Why it wins:** "Meet users where they are." It proves you understand user behavior. Asking users to download a new app or visit a new site is hard; letting them list via WhatsApp is a 10x UX improvement.

### 3. Smart "Bundle" Suggestions (AI Value Add)
- **Idea:** If a user lists exactly the items required for a specific semester/branch (e.g., "ED Drawing Board + Navathe DBMS"), the platform suggests creating a "3rd Sem CS Starter Kit" bundle at a 10% discount. 
- **Why it wins:** Judges love "circular economy" concepts. Grouping items increases average conversion value and helps juniors get everything in one go.

### 4. Dynamic "Panic Prices" driven by Academic Calendar
- **Idea:** Integrate a simple JSON configuration of the college's exam calendar. The UI highlights items like "Calculators" or "Lab Coats" 3 days before finals/labs begin, tagging them with "High Urgency" badges.
- **Why it wins:** Hyper-local context awareness. It proves the app is deeply integrated into regular student life, not just a generic template.

### 5. Escrow / Digital Handshake via QR Code (Reliability)
- **Idea:** Since payments are offline, how do you prevent fake listings or track trust scores accurately? Give the buyer a unique QR code. When they meet, the seller scans the buyer's QR code (or enters a 4-digit PIN) to mark the item as "Exchange Complete" and instantly award Campus Karma points.
- **Why it wins:** Adds a high-tech "magic moment" to the physical transaction and guarantees your Trust Score system is grounded in real-world exchanges.

## Constraints & Edge Cases
- Image moderation: Free tier storage might be abused; need size limits and potential basic NSFW filtering.
- API limits: Rate-limit the LLM submission to prevent spam/abuse of OpenAI credits.
