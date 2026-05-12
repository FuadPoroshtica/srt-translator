export interface SrtBlock {
  index: number;
  timestamp: string;
  lines: string[];
}

export function parseSrt(content: string): SrtBlock[] {
  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rawBlocks = normalized.trim().split(/\n{2,}/);
  const blocks: SrtBlock[] = [];

  for (const raw of rawBlocks) {
    const lines = raw.trim().split("\n");
    if (lines.length < 3) continue;

    const index = parseInt(lines[0].trim(), 10);
    const timestamp = lines[1].trim();
    const textLines = lines.slice(2).map((l) => l.trim()).filter(Boolean);

    if (isNaN(index) || !timestamp.includes("-->") || textLines.length === 0) continue;

    blocks.push({ index, timestamp, lines: textLines });
  }

  return blocks;
}

export function assembleSrt(blocks: SrtBlock[]): string {
  return blocks
    .map((b) => `${b.index}\n${b.timestamp}\n${b.lines.join("\n")}`)
    .join("\n\n") + "\n";
}
