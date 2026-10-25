import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "./config";

/** An error whose message is safe to show to the person using the app. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash("sha256");
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve(hash.digest("hex")))
      .on("error", reject);
  });
}

export function hashValue(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

/* --------------------------------------------------------------------------
 * Tiny disk cache. Good results are saved so a demo keeps working when the
 * venue Wi-Fi or an API has a bad moment.
 * ------------------------------------------------------------------------ */

function cachePath(bucket: string, key: string) {
  return path.join(config.cacheDir, bucket, `${key.slice(0, 40)}.json`);
}

export async function readCache<T>(bucket: string, key: string): Promise<T | null> {
  try {
    return JSON.parse(await readFile(cachePath(bucket, key), "utf8")) as T;
  } catch {
    return null;
  }
}

export async function writeCache(bucket: string, key: string, value: unknown): Promise<void> {
  const file = cachePath(bucket, key);
  try {
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, JSON.stringify(value, null, 2));
  } catch (err) {
    console.warn(`[beta] Could not write cache ${bucket}: ${(err as Error).message}`);
  }
}

/* --------------------------------------------------------------------------
 * Model output helpers
 * ------------------------------------------------------------------------ */

/** Parses JSON even when a model wraps it in prose or a ```json fence. */
export function parseJsonLoose<T>(text: string): T {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidate = fenced ? fenced[1] : trimmed.slice(trimmed.indexOf("{"), trimmed.lastIndexOf("}") + 1);
    return JSON.parse(candidate) as T;
  }
}

/** "1:05", "01:05", "0:01:05", "65s" → seconds. Returns null when it can't tell. */
export function parseTimestamp(t: string | null | undefined): number | null {
  if (!t) return null;
  const s = String(t).trim();
  const parts = s.split(":").map((p) => Number(p));
  if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }
  const plain = Number(s.replace(/s$/i, ""));
  return Number.isFinite(plain) ? plain : null;
}

export function formatTimestamp(seconds: number): string {
  const total = Math.max(0, Math.round(seconds));
  const m = Math.floor(total / 60);
  const sec = total % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

export function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Keeps a JSON blob under a size budget before it goes into a prompt. */
export function compactJson(value: unknown, maxChars = 12000): string {
  const text = JSON.stringify(value);
  return text.length <= maxChars ? text : `${text.slice(0, maxChars)}… [truncated]`;
}
