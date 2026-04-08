import { generateObject } from 'ai';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { NextResponse } from 'next/server';
import { listingSchema, LISTING_SYSTEM_PROMPT } from '@/lib/ai/prompts';

export async function POST(req: Request) {
  try {
    const openrouter = createOpenRouter({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const { rawText } = await req.json();

    if (!rawText) {
      return NextResponse.json({ error: 'Missing rawText in request body' }, { status: 400 });
    }

    const { object } = await generateObject({
      model: openrouter('openai/gpt-4o-mini'),
      schema: listingSchema,
      prompt: `${LISTING_SYSTEM_PROMPT}\n\nParse this listing: "${rawText}"`,
      maxRetries: 0,
    });

    return NextResponse.json(object);
  } catch (error: any) {
    console.error('LLM Extraction Error:', error);
    return NextResponse.json({ error: error.message || String(error) }, { status: 500 });
  }
}
