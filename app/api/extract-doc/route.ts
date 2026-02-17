import { NextRequest, NextResponse } from "next/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";

// Force Node.js runtime — word-extractor uses fs and native modules
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  // Vercel gives 500 MB of ephemeral /tmp storage per invocation
  const tmpPath = join("/tmp", `${randomUUID()}.doc`);

  try {
    await writeFile(tmpPath, buffer);

    // word-extractor is CommonJS with no TS types; require() avoids the ESM gap
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WordExtractor = require("word-extractor");
    const extractor = new WordExtractor();
    const doc = await extractor.extract(tmpPath);
    const text: string = doc.getBody();

    return NextResponse.json({ text });
  } finally {
    // Always clean up, even on error
    await unlink(tmpPath).catch(() => {});
  }
}
