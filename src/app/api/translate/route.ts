import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";
import { parseSrt, assembleSrt, SrtBlock } from "@/lib/srt";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const BATCH_SIZE = 60;

async function translateBatch(texts: string[]): Promise<string[]> {
  const numbered = texts.map((t, i) => `[${i + 1}] ${t}`).join("\n");

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: `You are a professional subtitle translator. Translate English subtitle text to Albanian (Shqip).
Rules:
- Preserve the exact numbering format [N] for each entry
- Keep line breaks within an entry using \\n
- Do NOT translate names, proper nouns, or technical terms unless a standard Albanian equivalent exists
- Maintain natural conversational Albanian — not overly formal
- Output ONLY the translated lines in the same [N] format, nothing else`,
    messages: [
      {
        role: "user",
        content: `Translate these English subtitle lines to Albanian:\n\n${numbered}`,
      },
    ],
  });

  const raw = (message.content[0] as { type: string; text: string }).text;
  const results: string[] = new Array(texts.length).fill("");

  for (const line of raw.split("\n")) {
    const match = line.match(/^\[(\d+)\]\s*(.*)/);
    if (match) {
      const idx = parseInt(match[1], 10) - 1;
      if (idx >= 0 && idx < texts.length) {
        results[idx] = match[2].replace(/\\n/g, "\n");
      }
    }
  }

  // Fallback: if a translation is missing keep original
  return results.map((r, i) => (r.trim() ? r : texts[i]));
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "No file provided" }, { status: 400 });
    }

    const content = await file.text();
    const blocks = parseSrt(content);

    if (blocks.length === 0) {
      return Response.json({ error: "No valid SRT blocks found" }, { status: 400 });
    }

    // Flatten all text lines across blocks for batching
    // Each block entry = one "unit" (joined lines)
    const texts = blocks.map((b) => b.lines.join("\n"));
    const translated: string[] = [];

    for (let i = 0; i < texts.length; i += BATCH_SIZE) {
      const batch = texts.slice(i, i + BATCH_SIZE);
      const result = await translateBatch(batch);
      translated.push(...result);
    }

    // Reassemble blocks with translated text
    const translatedBlocks: SrtBlock[] = blocks.map((b, i) => ({
      ...b,
      lines: translated[i].split("\n"),
    }));

    const srtOutput = assembleSrt(translatedBlocks);

    return new Response(srtOutput, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${file.name.replace(/\.srt$/i, "")}_al.srt"`,
      },
    });
  } catch (err) {
    console.error("Translation error:", err);
    return Response.json({ error: "Translation failed" }, { status: 500 });
  }
}
