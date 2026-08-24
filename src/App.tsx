import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useState } from "react";
import { NoteWindow } from "./NoteWindow";
import type { Note } from "./types";

function getNoteId(): string | null {
  return new URLSearchParams(window.location.search).get("id");
}

export default function App() {
  const [note, setNote] = useState<Note | null | undefined>(undefined);

  useEffect(() => {
    const id = getNoteId();
    if (!id) {
      setNote(null);
      return;
    }
    invoke<Note | null>("get_note", { id })
      .then(setNote)
      .catch(() => setNote(null));
  }, []);

  // The window is created hidden (see window::open_note_window) specifically
  // so it can be shown only once this has actually painted, instead of
  // flashing black while the webview loads.
  useEffect(() => {
    if (note === undefined) return;
    getCurrentWindow()
      .show()
      .catch(() => {});
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
