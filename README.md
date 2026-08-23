# Jotter

A markdown-native sticky-notes app for Linux, built with Tauri + React + TipTap.
Multiple independent, always-visible note windows (like Apple's Stickies), but
every note is markdown, and typing `/` on a new line opens a command menu
(headings, lists, to-dos, quotes, code blocks, dividers — Notion/Confluence style).

## Running it

A build is already exported to your host:

```
jotter
```

It also shows up in the GNOME app grid as **Jotter**. The launcher forces
`GDK_BACKEND=x11` — see "Wayland caveat" below for why.

Notes are stored as JSON (id, color, position, size, markdown content) in:

```
~/.local/share/com.dtucker.jotter/notes/
```

Closing a note's window just hides it; the app keeps running via a tray icon
(New Sticky Note / Show All Notes / Quit). Deleting a note is a separate action
(trash icon in the note's hover toolbar) and is permanent.

## Development

The build toolchain (Rust, Node, GTK/WebKit dev headers) lives in a Fedora 44
distrobox container rather than on the immutable Bazzite host — this avoids
`rpm-ostree` layering. The project source lives on the host and is
bind-mounted into the container automatically. The container is still named
`stickaroos-dev` (a leftover from before the app was renamed) — it's just a
build environment, not part of the shipped app, so it was left alone rather
than risk breaking the container to chase a cosmetic match.

```
distrobox enter stickaroos-dev
npm run tauri dev
```

To rebuild the release binary and re-export the launcher after backend changes:

```
distrobox enter stickaroos-dev
npm run tauri build
distrobox-export --bin "$(pwd)/src-tauri/target/release/jotter" --export-path ~/.local/bin
```

Use `npm run tauri build` (or `cargo tauri build`), not a plain `cargo build
--release` — the Tauri CLI enables the `custom-protocol` cargo feature that
makes the binary load its bundled frontend instead of trying to reach the
Vite dev server at `localhost:1420`. A plain `cargo build --release` produces
a binary that fails with "connection refused" the moment the dev server isn't
running.

(`distrobox-export --bin` must be run from inside the container.)

## Wayland caveat

GNOME's native Wayland session does not let client apps set or persist an
absolute window position — that's a deliberate Wayland restriction, not a bug
here. Under native Wayland every note would ignore its saved x/y and get
placed by the compositor instead, breaking both new-note cascading and
position-memory across restarts.

Running under XWayland (`GDK_BACKEND=x11`, which the exported launcher already
sets) restores normal positioning, since X11's window model allows it. This is
why the desktop entry and `~/.local/bin/jotter` both force it. Dragging,
resizing, and everything else works the same either way.

## Global shortcut

<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> creates a new note from anywhere.
It's registered in `src-tauri/src/lib.rs` (`new_note_shortcut()`) — if it
conflicts with an existing GNOME/IBus binding on your system, change the
`Modifiers`/`Code` there and rebuild.

## Feature notes

- Note colors: yellow, pink, blue, green, purple, gray (`src/colors.ts`).
- Pin/always-on-top toggle per note.
- Drag by the header strip to move; 8 invisible resize handles (edges +
  corners) around the note border let you resize, since `decorations: false`
  removes GTK's built-in resize grab zones (`src/ResizeHandles.tsx`).
- Minimize and close buttons in the header act like a normal GNOME window
  (minimize iconifies via the WM; close hides the window, it doesn't delete
  the note — the trash icon does that, separately and permanently).
- Drag a note to within ~40px of the left or right screen edge and let go;
  after it settles it collapses into a small tab docked to that edge, and
  clicking the tab expands it back. This is a session-only UI state — it's
  never written to the note's JSON file, and doesn't survive an app restart
  (`src-tauri/src/edge.rs`, `src/NoteWindow.tsx`).
- Slash menu items: Text, Heading 1-3, Bullet/Numbered/To-do lists, Quote,
  Code Block, Divider (`src/extensions/slashCommandItems.ts`) — add more
  there.
- Markdown is stored directly (via `tiptap-markdown`), so note files are
  plain, greppable markdown wrapped in a small JSON envelope.

## Icons

Source icons live in `icons/` (see `icons/README.md` for the palette and
design notes). `src-tauri/icons/` is generated from
`icons/io.github.you.Jotter.svg` via `npx tauri icon <path>` — rerun that
after editing the source SVG, rather than hand-editing the generated PNGs.
