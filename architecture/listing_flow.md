# Listing Flow (SOP)

## Goal
Reduce the friction of posting an item to under 60 seconds using the LLM assistant, capturing structured data deterministically.

## Steps
1. **User clicks (+) "New Listing"**
2. **Input:** User types a natural language string. e.g., "Selling my slightly used CS lab coat for 300 bucks."
3. **Parse Request:** Frontend calls `POST /api/extract` with the raw text.
4. **LLM Extraction Layer (`tools/ai`):**
   - OpenAI `gpt-4o-mini` is invoked using the Zod schema defined in `lib/ai/prompts.ts`.
   - It outputs: `{ title: "CS Lab Coat", category: "Apparel", price: 300, condition: "Good" }`
5. **Review Modal:** The structured data is presented back to the user in a form. 
   - User can upload an image (direct upload to Supabase Storage, returns `image_url`).
   - User can correct any fields the LLM got wrong.
6. **Database Insertion:** 
   - Frontend calls Supabase Client `supabase.from('listings').insert({...})`.
   - The query automatically maps `seller_id` to the currently logged in user via RLS (Row Level Security).
7. **Optimistic UI:** React Query instantly adds the new card to the local feed, and the user is redirected to `/`.

## Edge Cases
- **LLM Hallucination:** Since we use `generateObject` with strict Zod parsing, the output shape is guaranteed. If the text is garbage ("I like turtles"), the LLM will provide sensible default blanks or the API will return a 400.
- **Image Upload Failure:** The UI should allow listing without an image, or prompt the user to retry.
