import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT_DIR = path.resolve(here, "..");

// Load .env from the project root. Keys live only on the server; the browser never sees them.
const envFile = path.join(ROOT_DIR, ".env");
if (existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch (err) {
    console.warn(`[beta] Could not read .env: ${(err as Error).message}`);
  }
}

function clean(value: string | undefined): string {
  return (value ?? "").trim();
}

export const config = {
  port: Number(process.env.PORT) || 8787,

  gemini: {
    apiKey: clean(process.env.GEMINI_API_KEY),
    model: clean(process.env.GEMINI_MODEL) || "gemini-3.8-flash",
    /** Tried in order when the main model is overloaded. */
    fallbackModels: (clean(process.env.GEMINI_FALLBACK_MODELS) || "gemini-3.6-flash,gemini-3.5-flash-lite")
      .split(",")
      .map((m) => m.trim())
      .filter(Boolean),
    /** Only for tests: point the SDK at a mock server. */
    baseUrl: clean(process.env.GEMINI_BASE_URL) || undefined,
  },

  muse: {
    // Meta's docs call this MODEL_API_KEY; META_API_KEY also works.
    apiKey: clean(process.env.MODEL_API_KEY) || clean(process.env.META_API_KEY),
    model: clean(process.env.MUSE_MODEL) || "muse-spark-1.3",
    baseUrl: (clean(process.env.MUSE_BASE_URL) || "https://api.meta.ai/v1").replace(/\/+$/, ""),
  },

  /** Optional: the AI Mentor's MediaPipe pose service. POST a video, get observations JSON back. */
  poseServiceUrl: clean(process.env.POSE_SERVICE_URL) || undefined,

  cacheDir: path.join(ROOT_DIR, "server", ".cache"),
  uploadDir: path.join(ROOT_DIR, "server", ".uploads"),
  distDir: path.join(ROOT_DIR, "dist"),
};

export const geminiReady = () => config.gemini.apiKey.length > 0;
export const museReady = () => config.muse.apiKey.length > 0;
