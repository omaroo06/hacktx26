import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";

function hasFiles(e: DragEvent) {
  return Array.from(e.dataTransfer?.types ?? []).includes("Files");
}

/** Drag-and-drop handlers for a drop target, with a reliable "dragging over" flag. */
export function useFileDrop(onFiles: (files: FileList) => void) {
  const [isDragging, setIsDragging] = useState(false);
  const depth = useRef(0);

  // Stop the browser from navigating to a file dropped just outside the target.
  useEffect(() => {
    const prevent = (e: globalThis.DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("dragover", prevent);
    window.addEventListener("drop", prevent);
    return () => {
      window.removeEventListener("dragover", prevent);
      window.removeEventListener("drop", prevent);
    };
  }, []);

  const onDragEnter = useCallback((e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    depth.current++;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent) => {
    if (!hasFiles(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  }, []);

  const onDragLeave = useCallback((e: DragEvent) => {
    if (!hasFiles(e)) return;
    depth.current = Math.max(0, depth.current - 1);
    if (depth.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return { isDragging, dropHandlers: { onDragEnter, onDragOver, onDragLeave, onDrop } };
}
