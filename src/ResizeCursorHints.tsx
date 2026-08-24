const ZONES = [
  { className: "rc-n", cursor: "ns-resize" },
  { className: "rc-s", cursor: "ns-resize" },
  { className: "rc-e", cursor: "ew-resize" },
  { className: "rc-w", cursor: "ew-resize" },
  { className: "rc-ne", cursor: "nesw-resize" },
  { className: "rc-sw", cursor: "nesw-resize" },
  { className: "rc-nw", cursor: "nwse-resize" },
  { className: "rc-se", cursor: "nwse-resize" },
] as const;

/**
 * Purely visual: shows the right resize cursor over Tauri's native
 * undecorated-window border grab (a hardcoded 5px inset on Linux — see
 * README "Feature notes"). No mouse handlers, no startResizeDragging() —
 * the actual resize-drag is entirely native. Two earlier attempts at
 * JS-driven custom resize handles both caused the window to visibly
 * shrink/grow erratically mid-drag; keep it that way; don't add drag logic
 * here.
 */
export function ResizeCursorHints() {
  return (
    <>
      {ZONES.map(({ className, cursor }) => (
        <div key={className} className={`resize-cursor ${className}`} style={{ cursor }} />
      ))}
    </>
  );
}
