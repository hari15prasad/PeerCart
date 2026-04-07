import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file
config({ path: resolve(__dirname, "../.env") });

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey || apiKey.includes("your-openai-api-key")) {
  console.error("❌ Setup incomplete: Missing valid OPENAI_API_KEY in .env");
  process.exit(1);
}

const openai = createOpenAI({ apiKey });

async function testOpenAI() {
  console.log("🧠 Connecting to OpenAI (gpt-4o-mini)...");
  const testInput = "Selling my 3rd sem DBMS book by Navathe, good condition, ₹400";
  console.log(`📝 Test string: "${testInput}"`);

  // Time the response
  const start = performance.now();
  
  try {
    const { object } = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: z.object({
        title: z.string(),
        category: z.string(),
        price: z.number(),
        condition: z.string(),
        metadata: z.record(z.string(), z.any()),
      }),
      prompt: `Parse the following college marketplace listing into structured data: "${testInput}"`,
    });
    
    const end = performance.now();
    const duration = (end - start).toFixed(2);
    
    console.log(`✅ Success! Extracted payload in ${duration}ms:`);
    console.log(JSON.stringify(object, null, 2));

  } catch (error) {
    console.error("❌ Check failed:", error);
  }
}

testOpenAI();
