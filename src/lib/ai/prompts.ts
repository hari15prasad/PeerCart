import { z } from 'zod';

export const listingSchema = z.object({
  title: z.string().describe("A concise and clear title for the item, max 50 characters."),
  category: z.enum(["Books", "Lab Coat", "Electronics", "Stationery", "Other"]).describe("The physical category of the item."),
  price: z.number().min(0).describe("The requested price in INR (integer). Extracted from words like 'bucks', 'rupees', or symbols. Use 0 if unspecified."),
  condition: z.enum(["New", "Good", "Fair"]).describe("The physical condition. Infer 'New' if completely unused, 'Fair' if heavily used, else 'Good'."),
  metadata: z.object({
    semester: z.number().describe("The semester number, e.g. 3. Return 0 if unknown."),
    edition: z.string().describe("The edition of the item. Return empty string if unknown."),
    author: z.string().describe("The author. Return empty string if unknown."),
    brand: z.string().describe("The brand. Return empty string if unknown.")
  }).describe("Extract extra useful entities. All fields are required, use defaults if unknown.")
});

export const LISTING_SYSTEM_PROMPT = `
You are the PeerCart extraction engine. 
A student will provide a casual sentence about an item they want to sell.
Extract the key details into the required schema. Ensure the price is a pure integer.
If they say "500 bucks", the price is 500.
If they don't specify a condition, default to "Good".
If they don't specify a price, leave as 0 (we will prompt them).
`;
