import { useEffect, useRef, useState, type CSSProperties } from "react";
import { invoke, isMac, listen } from "./bridge";
import { COLOR_ORDER, COLORS } from "./colors";
import { NoteEditor } from "./Editor";
import { CloseIcon, InfoIcon, MenuIcon, MinimizeIcon, PinIcon, PlusIcon, ShowAllIcon, TrashIcon } from "./icons";
import { ResizeCursorHints } from "./ResizeCursorHints";
import type { Note, NoteColor } from "./types";

const AUTOSAVE_DELAY_MS = 400;

const isNoteColor = (value: unknown): value is NoteColor =>
  typeof value === "string" && (COLOR_ORDER as string[]).includes(value);

interface NoteWindowProps {
  note: Note;
}

export function NoteWindow({ note }: NoteWindowProps) {
  const [color, setColor] = useState<NoteColor>(note.color);
  const [alwaysOnTop, setAlwaysOnTop] = useState(note.alwaysOnTop);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const contentRef = useRef(note.content);
  const saveTimer = useRef<number | undefined>(undefined);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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
    if (!menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || menuButtonRef.current?.contains(target)) return;
      setMenuOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const handleColorChange = (next: NoteColor) => {
    setColor(next);
    invoke("set_note_color", { id: note.id, color: next }).catch(() => {});
    setMenuOpen(false);
  };

  const handleTogglePin = () => {
    const next = !alwaysOnTop;
    setAlwaysOnTop(next);
    invoke("toggle_always_on_top", { id: note.id, value: next }).catch(() => {});
  };

  const handleNewNote = () => {
    invoke("create_note").catch(() => {});
    setMenuOpen(false);
  };

  const handleShowAll = () => {
    invoke("show_all_notes").catch(() => {});
    setMenuOpen(false);
  };

  const handleAbout = () => {
    invoke("create_about_note").catch(() => {});
    setMenuOpen(false);
  };

  // macOS asks with a native sheet (shared with the window's close button);
  // Linux uses the in-note overlay below.
  const handleDelete = () => {
    setMenuOpen(false);
    if (isMac) {
      flushSave();
      invoke("request_delete", { id: note.id }).catch(() => {});
    } else {
      setConfirmingDelete(true);
    }
  };

  const handleConfirmDelete = () => {
    setConfirmingDelete(false);
    flushSave();
    invoke("delete_note", { id: note.id }).catch(() => {});
  };

  const handleMinimize = () => {
    invoke("minimize_note_window", { id: note.id }).catch(() => {});
  };

  // The macOS menu bar drives the same handlers as the in-note controls.
  const handlersRef = useRef({ handleColorChange, handleTogglePin });
  handlersRef.current = { handleColorChange, handleTogglePin };

  useEffect(() => {
    const offs = [
      listen("set-color", (value) => {
        if (isNoteColor(value)) handlersRef.current.handleColorChange(value);
      }),
      listen("toggle-pin", () => handlersRef.current.handleTogglePin()),
      listen("flush", () => flushSave()),
    ];
    return () => offs.forEach((off) => off());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const palette = COLORS[color];

  const menuButton = (
    <button
      ref={menuButtonRef}
      type="button"
      className={`${isMac ? "note-icon-btn" : "note-round-btn"}${menuOpen ? " is-active" : ""}`}
      title="Note menu"
      onClick={() => setMenuOpen((open) => !open)}
    >
      <MenuIcon size={isMac ? 18 : 16} />
    </button>
  );

  const menu = menuOpen && (
    <div className="note-menu" ref={menuRef}>
      <button type="button" className="note-menu-item" onClick={handleNewNote}>
        <PlusIcon />
        <span>New note</span>
      </button>
      <button type="button" className="note-menu-item" onClick={handleShowAll}>
        <ShowAllIcon />
        <span>Show all notes</span>
      </button>
      <div className="note-menu-sep" />
      <div className="note-menu-colors">
        {COLOR_ORDER.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={COLORS[c].label}
            className={`note-menu-swatch${c === color ? " is-active" : ""}`}
            style={{ background: COLORS[c].swatch }}
            onClick={() => handleColorChange(c)}
          />
        ))}
      </div>
      <div className="note-menu-sep" />
      <button type="button" className="note-menu-item" onClick={handleAbout}>
        <InfoIcon />
        <span>About</span>
      </button>
      <div className="note-menu-sep" />
      <button type="button" className="note-menu-item is-danger" onClick={handleDelete}>
        <TrashIcon />
        <span>Delete note</span>
      </button>
    </div>
  );

  // On macOS the header sits under the native title bar, whose traffic
  // lights draw over its left end, so the note's own controls go right.
  const macHeader = (
    <div
      className="note-header"
      onMouseDown={(event) => {
        if (event.button === 0 && event.target === event.currentTarget) invoke("start_drag").catch(() => {});
      }}
      onDoubleClick={(event) => {
        if (event.target === event.currentTarget) invoke("titlebar_double_click").catch(() => {});
      }}
    >
      <div className={`note-controls${menuOpen ? " is-open" : ""}`}>
        <button
          type="button"
          className={`note-icon-btn${alwaysOnTop ? " is-active" : ""}`}
          title={alwaysOnTop ? "Stop floating on top" : "Float on top"}
          onClick={handleTogglePin}
        >
          <PinIcon filled={alwaysOnTop} size={17} />
        </button>
        <div className="note-menu-anchor">
          {menuButton}
          {menu}
        </div>
      </div>
    </div>
  );

  const linuxHeader = (
    <div className="note-header">
      <div className={`note-menu-anchor${menuOpen ? " is-open" : ""}`}>
        {menuButton}
        {menu}
      </div>
      <div className="note-header-drag" data-tauri-drag-region="true" />
      <div className="note-winctl">
        <button
          type="button"
          className={`note-round-btn${alwaysOnTop ? " is-active" : ""}`}
          title={alwaysOnTop ? "Unpin" : "Keep on top"}
          onClick={handleTogglePin}
        >
          <PinIcon filled={alwaysOnTop} size={16} />
        </button>
        <button type="button" className="note-round-btn" title="Minimize" onClick={handleMinimize}>
          <MinimizeIcon size={16} />
        </button>
        <button type="button" className="note-round-btn note-round-btn-close" title="Delete note" onClick={handleDelete}>
          <CloseIcon size={16} />
        </button>
      </div>
    </div>
  );

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
      {isMac ? macHeader : linuxHeader}
      <NoteEditor content={note.content} onChange={scheduleSave} onBlur={flushSave} />
      {!isMac && <ResizeCursorHints />}
      {confirmingDelete && (
        <div className="note-confirm-overlay">
          <div className="note-confirm-card">
            <p className="note-confirm-message">Delete this note? This can't be undone.</p>
            <div className="note-confirm-actions">
              <button type="button" className="note-confirm-btn note-confirm-btn-cancel" onClick={() => setConfirmingDelete(false)}>
                Cancel
              </button>
              <button type="button" className="note-confirm-btn note-confirm-btn-danger" onClick={handleConfirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
