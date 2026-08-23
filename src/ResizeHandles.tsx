import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent } from "react";

const EDGES = [
  { className: "rh-n", direction: "North" },
  { className: "rh-s", direction: "South" },
  { className: "rh-e", direction: "East" },
  { className: "rh-w", direction: "West" },
  { className: "rh-ne", direction: "NorthEast" },
  { className: "rh-nw", direction: "NorthWest" },
  { className: "rh-se", direction: "SouthEast" },
  { className: "rh-sw", direction: "SouthWest" },
] as const;

export function ResizeHandles() {
  const startResize = (direction: (typeof EDGES)[number]["direction"]) => (e: MouseEvent) => {
    e.preventDefault();
    getCurrentWindow()
      .startResizeDragging(direction)
      .catch(() => {});
  };

  return (
    <>
      {EDGES.map(({ className, direction }) => (
        <div key={className} className={`resize-handle ${className}`} onMouseDown={startResize(direction)} />
      ))}
    </>
  );
}
