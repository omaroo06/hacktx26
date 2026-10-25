import { useCallback, useEffect, useRef, useState } from "react";
import type { WallPhoto } from "../types/wall";
import { readImageSize, validateWallFile } from "../lib/imageValidation";

export type WallPhotoStatus = "empty" | "loading" | "ready";

export interface UseWallPhoto {
  photo: WallPhoto | null;
  status: WallPhotoStatus;
  error: string | null;
  /** Validates and loads a file, replacing any current photo on success. */
  loadFile: (file: File) => Promise<void>;
  /** Picks the first file from a FileList (drop or input), with a note if several were given. */
  loadFiles: (files: FileList | null) => void;
  remove: () => void;
  clearError: () => void;
}

export function useWallPhoto(): UseWallPhoto {
  const [photo, setPhoto] = useState<WallPhoto | null>(null);
  const [status, setStatus] = useState<WallPhotoStatus>("empty");
  const [error, setError] = useState<string | null>(null);
  const photoRef = useRef<WallPhoto | null>(null);
  const loadToken = useRef(0);

  const swapPhoto = useCallback((next: WallPhoto | null) => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
    photoRef.current = next;
    setPhoto(next);
  }, []);

  useEffect(() => () => {
    if (photoRef.current) URL.revokeObjectURL(photoRef.current.url);
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      const result = validateWallFile(file);
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const token = ++loadToken.current;
      const url = URL.createObjectURL(file);
      setError(null);
      setStatus("loading");

      try {
        const { width, height } = await readImageSize(url);
        if (token !== loadToken.current) {
          URL.revokeObjectURL(url);
          return;
        }
        swapPhoto({
          file,
          url,
          name: file.name,
          sizeBytes: file.size,
          mimeType: file.type || "image/*",
          widthPx: width,
          heightPx: height,
        });
        setStatus("ready");
      } catch {
        URL.revokeObjectURL(url);
        if (token !== loadToken.current) return;
        setError(`“${file.name}” couldn’t be opened. The file may be damaged, so try another photo.`);
        setStatus(photoRef.current ? "ready" : "empty");
      }
    },
    [swapPhoto],
  );

  const loadFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void loadFile(files[0]).then(() => {
        if (files.length > 1) {
          setError((current) =>
            current ?? `beta maps one wall at a time, so only “${files[0].name}” was used.`,
          );
        }
      });
    },
    [loadFile],
  );

  const remove = useCallback(() => {
    loadToken.current++;
    swapPhoto(null);
    setStatus("empty");
    setError(null);
  }, [swapPhoto]);

  const clearError = useCallback(() => setError(null), []);

  return { photo, status, error, loadFile, loadFiles, remove, clearError };
}
