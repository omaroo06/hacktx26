export const ACCEPTED_MIME_TYPES = ["image/jpeg", "image/png"] as const;
export const ACCEPTED_EXTENSIONS = [".jpg", ".jpeg", ".png"] as const;
export const ACCEPT_ATTRIBUTE = [...ACCEPTED_MIME_TYPES, ...ACCEPTED_EXTENSIONS].join(",");
export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export type ValidationResult = { ok: true } | { ok: false; message: string };

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot).toLowerCase();
}

export function validateWallFile(file: File): ValidationResult {
  const ext = extensionOf(file.name);
  const typeOk = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);
  const extOk = (ACCEPTED_EXTENSIONS as readonly string[]).includes(ext);

  // Some systems report an empty MIME type, so fall back to the extension.
  if (!typeOk && !(file.type === "" && extOk)) {
    const shown = ext ? ext.slice(1).toUpperCase() : file.type || "unknown";
    return {
      ok: false,
      message: `“${file.name}” is a ${shown} file. beta reads JPG, JPEG, or PNG photos.`,
    };
  }

  if (file.size === 0) {
    return { ok: false, message: `“${file.name}” is empty. Try exporting the photo again.` };
  }

  if (file.size > MAX_FILE_BYTES) {
    return {
      ok: false,
      message: `“${file.name}” is ${formatBytes(file.size)}. Please use a photo under ${formatBytes(MAX_FILE_BYTES)}.`,
    };
  }

  return { ok: true };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
}

/** Decodes an image to confirm it is readable and to get its natural size. */
export function readImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("decode-failed"));
    img.src = url;
  });
}
