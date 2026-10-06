import { useEffect, useState } from "react";
import { loadNote, notifyReady } from "./bridge";
import { NoteWindow } from "./NoteWindow";
import type { Note } from "./types";

export default function App() {
  const [note, setNote] = useState<Note | null | undefined>(undefined);

  useEffect(() => {
    loadNote()
      .then(setNote)
      .catch(() => setNote(null));
  }, []);

  // The window is created hidden (see window::open_note_window and
  // macos/Sources/Jotter/NoteWindowController.swift) specifically so it can
  // be shown only once this has rendered, instead of flashing while the
  // webview loads. Not requestAnimationFrame: WebKit on macOS doesn't run
  // frame callbacks for a window that isn't visible yet.
  useEffect(() => {
    if (note === undefined) return;
    notifyReady().catch(() => {});
  }, [note]);

  if (note === undefined) {
    return null;
  }

  if (note === null) {
    return (
      <div className="note-fallback">
        <p>This note could not be loaded.</p>
      </div>
    );
  }

  return <NoteWindow note={note} />;
}
