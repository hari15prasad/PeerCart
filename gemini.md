# 📜 PeerCart — Project Constitution (gemini.md)

> **This file is law.** All schemas, rules, and architectural invariants live here.

---

## Data Schema

### 1. LLM Assistant Payload
**INPUT (to LLM):**
```json
{
  "raw_text": "Selling my 3rd sem DBMS book by Navathe, good condition, ₹400"
}
```

**OUTPUT (from LLM / Payload to DB):**
```json
{
  "title": "DBMS by Navathe",
  "category": "Books",
  "price": 400,
  "condition": "Good",
  "metadata": {
    "semester": 3,
    "edition": "Navathe"
  }
}
```

### 2. Core Database Entities (Supabase)
- **Profile:** `{ id: UUID, email: String, full_name: String, student_year: Int, branch: String, trust_score: Int }`
- **Listing:** `{ id: UUID, seller_id: UUID, title: String, description: String, category: String, price: Int, condition: String, image_url: String, status: String, metadata: JSONB }`
- **Interest:** `{ id: UUID, listing_id: UUID, buyer_id: UUID, status: String }`

## Behavioral Rules
1. **No Payment Processing:** All transactions are offline (cash/UPI meetup). The app only connects buyers and sellers.
2. **Restricted Access:** Mandatory `@college.edu` (or equivalent institutional) email domain validation for registration.
3. **Data Privacy:** Do not expose seller contact information (phone number) until a transaction intent is mutually verified.
4. **Optimistic UI:** All user actions (like "Express Interest") must feel instantaneous on the UI, with backend synchronizations happening asynchronously.
5. **Speed-to-Transaction:** Listing flow must take under 60 seconds driven by LLM parsing.

## Architectural Invariants
1. No code in `tools/` until the Blueprint is approved.
2. All business logic is deterministic — no LLM guessing for database states or routing.
3. `.env` holds all secrets; never hardcoded.
4. `.tmp/` is ephemeral; only the Payload is permanent.
5. If logic changes, update the SOP in `architecture/` **before** updating code.
6. **Denormalization for Reads:** Cache seller fields (year, branch) on listings to avoid joins on the main feed.

## Integrations
- **Frontend / Fullstack:** Next.js (App Router), React Query, NextAuth.js
- **Database / Auth / Storage:** Supabase
- **AI Processing:** OpenAI API (`gpt-4o-mini`) via Vercel AI SDK
- **Styling:** Tailwind CSS + Shadcn UI
- **Deployment:** Vercel
- **Analytics:** PostHog

## Maintenance Log
_To be populated during Trigger phase._
