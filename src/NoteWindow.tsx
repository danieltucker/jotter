import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { COLOR_ORDER, COLORS } from "./colors";
import { NoteEditor } from "./Editor";
import { ChevronIcon, CloseIcon, MinimizeIcon, PinIcon, PlusIcon, TrashIcon } from "./icons";
import { ResizeHandles } from "./ResizeHandles";
import type { Note, NoteColor } from "./types";

const AUTOSAVE_DELAY_MS = 400;

type DockEdge = "left" | "right" | "none";

interface NoteWindowProps {
  note: Note;
}

export function NoteWindow({ note }: NoteWindowProps) {
  const [color, setColor] = useState<NoteColor>(note.color);
  const [alwaysOnTop, setAlwaysOnTop] = useState(note.alwaysOnTop);
  const [dockEdge, setDockEdge] = useState<DockEdge>("none");

  const contentRef = useRef(note.content);
  const saveTimer = useRef<number | undefined>(undefined);

  const flushSave = () => {
    window.clearTimeout(saveTimer.current);
    invoke("save_note_content", { id: note.id, content: contentRef.current }).catch(() => {});
  };

  const scheduleSave = (markdown: string) => {
    contentRef.current = markdown;
    window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(flushSave, AUTOSAVE_DELAY_MS);
  };

  useEffect(() => {
    window.addEventListener("beforeunload", flushSave);
    return () => {
      window.removeEventListener("beforeunload", flushSave);
      window.clearTimeout(saveTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const unlisten = getCurrentWindow().listen<DockEdge>("dock-changed", (event) => {
      setDockEdge(event.payload);
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  const handleUndock = () => {
    invoke("undock_note", { id: note.id }).catch(() => {});
  };

  const handleColorChange = (next: NoteColor) => {
    setColor(next);
    invoke("set_note_color", { id: note.id, color: next }).catch(() => {});
  };

  const handleTogglePin = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    invoke("toggle_always_on_top", { id: note.id, value: next }).catch(() => {});
  };

  const handleNewNote = () => {
    invoke("create_note").catch(() => {});
  };

  const handleDelete = () => {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    flushSave();
    invoke("delete_note", { id: note.id }).catch(() => {});
  };

  const handleMinimize = () => {
    invoke("minimize_note_window", { id: note.id }).catch(() => {});
  };

  const handleClose = () => {
    flushSave();
    invoke("close_note_window", { id: note.id }).catch(() => {});
  };

  const palette = COLORS[color];

  if (dockEdge !== "none") {
    return (
      <button
        type="button"
        className={`note-edge-tab note-edge-tab-${dockEdge}`}
        style={{ background: palette.bg, color: palette.ink, borderColor: palette.header }}
        title="Expand note"
        onClick={handleUndock}
      >
        <ChevronIcon direction={dockEdge === "left" ? "right" : "left"} />
      </button>
    );
  }

  return (
    <div
      className="note"
      style={
        {
          "--note-bg": palette.bg,
          "--note-header": palette.header,
          "--note-ink": palette.ink,
        } as CSSProperties
      }
    >
      <div className="note-header">
        <div className="note-swatches">
          {COLOR_ORDER.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={COLORS[c].label}
              className={`note-swatch${c === color ? " is-active" : ""}`}
              style={{ background: COLORS[c].swatch }}
              onClick={() => handleColorChange(c)}
            />
          ))}
        </div>
        <div className="note-header-drag" data-tauri-drag-region="true" />
        <div className="note-actions">
          <button
            type="button"
            className={`note-action${alwaysOnTop ? " is-active" : ""}`}
            title={alwaysOnTop ? "Unpin" : "Keep on top"}
            onClick={handleTogglePin}
          >
            <PinIcon filled={alwaysOnTop} />
          </button>
          <button type="button" className="note-action" title="New note" onClick={handleNewNote}>
            <PlusIcon />
          </button>
          <button type="button" className="note-action" title="Delete note" onClick={handleDelete}>
            <TrashIcon />
          </button>
          <span className="note-action-sep" />
          <button type="button" className="note-action" title="Minimize" onClick={handleMinimize}>
            <MinimizeIcon />
          </button>
          <button type="button" className="note-action note-action-close" title="Close" onClick={handleClose}>
            <CloseIcon />
          </button>
        </div>
      </div>
      <NoteEditor content={note.content} onChange={scheduleSave} onBlur={flushSave} />
      <ResizeHandles />
    </div>
  );
}
