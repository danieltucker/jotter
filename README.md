<div align="center">

# Jotter

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

A markdown-native sticky-notes app for Linux, built with Tauri + React + TipTap.
Multiple independent, always-visible note windows (like Apple's Stickies), but
every note is markdown, and typing `/` on a new line opens a command menu
(headings, lists, to-dos, quotes, code blocks, dividers, Notion/Confluence style).

<img src="screenshots/welcome-note.png?v=2" width="440" alt="A Jotter note showing markdown rendering: a heading, bold text, a to-do, a quote, and a code block">

</div>

## Features

- Multiple independent, always-visible note windows, each its own small
  draggable/resizable window (like Apple's Stickies).
- Every note is markdown under the hood: standard syntax converts as you
  type, or press `/` for a command menu (headings, lists, to-dos, quotes,
  code blocks, dividers).
- Selecting text pops up a formatting toolbar: bold, italic, strikethrough,
  code, plus quick toggles for heading/bullet list/to-do list.
- Paste an image (e.g. a screenshot) straight into a note.
- 6 note colors, and a pin toggle to keep a note always-on-top.
- <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> creates a new note from
  anywhere, even when Jotter isn't focused (see "Global shortcut" below).

<p align="center">
  <img src="screenshots/slash-menu.png" width="260" alt="The `/` slash-command menu, scrolled to a selected item further down the list">
  &nbsp;&nbsp;
  <img src="screenshots/note-menu.png" width="260" alt="The note's hamburger menu: New note, Show all notes, color swatches, About, Delete note">
</p>

Built with [Tauri](https://tauri.app) (Rust backend, one native window per
note) + [React](https://react.dev) + [TipTap](https://tiptap.dev) (the
editor), with note content stored as plain markdown via `tiptap-markdown`.

## Getting started

```
git clone https://github.com/danieltucker/jotter.git
cd jotter
npm install
npm run tauri build
```

This needs Rust, Node, and Tauri's Linux prerequisites (GTK/WebKit dev
headers) installed; see [Tauri's Linux setup
guide](https://tauri.app/start/prerequisites/) if `npm run tauri build`
fails on missing system libraries. The built binary ends up at
`src-tauri/target/release/jotter`, runnable directly, no install step needed.

For the day-to-day dev workflow on this project's own machine (a Bazzite
host, distrobox toolchain, exported launcher), see "Development" below.

## Notes storage

Notes are stored as JSON (id, color, position, size, markdown content) in:

```
~/.local/share/com.danielgt.jotter/notes/
```

This path is derived from `identifier` in `src-tauri/tauri.conf.json`. If you
ever change it, the app looks in a new, empty directory: copy
`~/.local/share/<old identifier>/notes/` into
`~/.local/share/<new identifier>/notes/` first, or existing notes won't show
up (they aren't lost, just invisible until the directory is migrated).

Closing a note's window deletes that note (same destructive action as the
trash icon in the note's hover toolbar, with the same confirmation dialog).
The app quits normally once the last note window closes; there's no tray
icon or background-running mode.

<p align="center">
  <img src="screenshots/delete-confirm.png" width="360" alt="The delete-confirmation dialog over a note">
</p>

## Development

The build toolchain (Rust, Node, GTK/WebKit dev headers) lives in a Fedora 44
distrobox container rather than on the immutable Bazzite host; this avoids
`rpm-ostree` layering. The project source lives on the host and is
bind-mounted into the container automatically. The container is still named
`stickaroos-dev` (a leftover from before the app was renamed); it's just a
build environment, not part of the shipped app, so it was left alone rather
than risk breaking the container to chase a cosmetic match.

Once a release binary has been exported (see `distrobox-export --bin`
below), it also shows up in the GNOME app grid as **Jotter**, and can be run
directly from anywhere with just `jotter`. The launcher forces
`GDK_BACKEND=x11`; see "Wayland caveat" below for why.

<p align="center">
  <img src="screenshots/taskbar.png" width="520" alt="Jotter's icon pinned to the GNOME taskbar">
</p>

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
--release`; the Tauri CLI enables the `custom-protocol` cargo feature that
makes the binary load its bundled frontend instead of trying to reach the
Vite dev server at `localhost:1420`. A plain `cargo build --release` produces
a binary that fails with "connection refused" the moment the dev server isn't
running.

(`distrobox-export --bin` must be run from inside the container.)

The first `distrobox-export --bin` for a given binary generates
`~/.local/share/applications/com.danielgt.jotter.desktop` without a
`StartupWMClass` line. Without it, GNOME can't match the running window back
to the desktop entry, so the taskbar/dash/alt-tab icon falls back to a
generic one even though `Icon=com.danielgt.jotter` is correct. Add it once:

```
echo 'StartupWMClass=Jotter' >> ~/.local/share/applications/com.danielgt.jotter.desktop
```

(Verified: re-running `distrobox-export --bin` afterwards is idempotent and
does not strip this line; you don't need to re-add it after every rebuild,
only after a first-time export or if the `.desktop` file is ever deleted.)

## Wayland caveat

GNOME's native Wayland session does not let client apps set or persist an
absolute window position; that's a deliberate Wayland restriction, not a bug
here. Under native Wayland every note would ignore its saved x/y and get
placed by the compositor instead, breaking both new-note cascading and
position-memory across restarts.

Running under XWayland (`GDK_BACKEND=x11`, which the exported launcher already
sets) restores normal positioning, since X11's window model allows it. This is
why the desktop entry and `~/.local/bin/jotter` both force it. Dragging,
resizing, and everything else works the same either way.

## Global shortcut

<kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>N</kbd> creates a new note from anywhere.
It's registered in `src-tauri/src/lib.rs` (`new_note_shortcut()`); if it
conflicts with an existing GNOME/IBus binding on your system, change the
`Modifiers`/`Code` there and rebuild.

## Implementation notes

- Note colors: yellow, pink, blue, green, purple, gray (`src/colors.ts`).
- Pin/always-on-top toggle per note.
- Drag by the header strip to move. Resizing from the border uses only
  Tauri's built-in undecorated-window border grab (a 5px inset on Linux,
  hardcoded, not configurable, see `undecorated_resizing.rs` in
  `tauri-runtime-wry`); no custom resize-handle component. Two different
  attempts at a custom `ResizeHandles.tsx` layered on top of that built-in
  grab (to make the ~5px margin easier to hit) both reintroduced the same
  family of bug: the window visibly shrinking/growing erratically mid-drag.
  The first attempt overlapped the built-in 0-5px zone outright; the second
  offset the custom handles to start exactly at 5px to avoid that overlap,
  and the erratic resizing still came back (this time reported as the top
  jittering while dragging the *bottom* edge), so whatever the real
  conflict is, it isn't just pixel overlap with the documented 5px inset,
  and it wasn't fully understood before being reverted. If you want to
  revisit widening the grab margin, that's the trap to debug first, ideally
  with a way to test a real mouse drag, since neither Wayland's blocking of
  synthetic pointer input nor this project's screenshot-based verification
  loop caught either regression before a human did.

  `ResizeCursorHints.tsx` is a separate, safe addition on top of that native
  grab: thin overlays at the same 5px edges/corners that only set the CSS
  `cursor` (ns-resize/ew-resize/nwse-resize/nesw-resize) on hover, with no
  mouse handlers of their own. The native GTK handler that actually starts
  the resize-drag fires at the window-widget level regardless of what's in
  the DOM, so this can't reintroduce the drag-conflict bug above; it only
  fixes the resize border showing a text-select cursor instead of a resize
  one.
- Minimize iconifies via the WM. The close (×) button is deliberately the
  same destructive action as "Delete note" in the hamburger menu, same
  confirmation dialog, same `delete_note` command. There is no separate
  "just hide the window" close anymore; there was a `close_note_window`
  command for that, but it's gone, and don't bring it back without also
  bringing back a non-destructive way to close from the header, since the ×
  icon alone no longer means "just hide." Every saved note still reopens
  automatically on the next full app launch regardless of what was open at
  exit (`app::load_startup_notes` reopens everything in the notes
  directory). "Show all notes" in the hamburger menu (`show_all_notes`
  command) reopens any note that's merely minimized, without a full app
  restart.
- Note windows are created with `.visible(false)` and shown by the frontend
  (`App.tsx`, once `note` state settles either way) rather than at creation,
  so there's no flash of Tauri's default black background while the webview
  loads. An earlier attempt fixed the flash by setting `background_color` to
  the note's own color while keeping `transparent(true)`; that broke
  transparency instead: the rounded corners rendered opaque white rather
  than see-through. Don't combine those two again; if you touch this, the
  hidden-until-ready pattern is the one that's actually been shown to keep
  transparency intact.
- Slash menu items: Text, Heading 1-3, Bullet/Numbered/To-do lists, Quote,
  Code Block, Divider (`src/extensions/slashCommandItems.ts`); add more
  there.
- Markdown is stored directly (via `tiptap-markdown`), so note files are
  plain, greppable markdown wrapped in a small JSON envelope. Links
  (`@tiptap/extension-link`) render but don't open on a plain click
  (`openOnClick: false` so you can click into link text to edit it), only on
  ctrl/cmd+click, handled manually in `Editor.tsx` since the extension has
  no built-in modifier-key fallback.
- "About" in the hamburger menu opens a new sticky note (`note::ABOUT_CONTENT`,
  `create_about_note` command) with author links, rather than opening a
  browser directly, consistent with the app's own note-taking medium.
  Opening links from within a note goes through `@tauri-apps/plugin-opener`'s
  `openUrl`, permitted by the `opener:default` capability in
  `src-tauri/capabilities/default.json`.
  Building this surfaced a sharp debugging trap created by the
  `.visible(false)` pattern above: a binary built with a plain
  `cargo build --release` (skipping the Tauri CLI, so no `custom-protocol`
  feature, see "Development" above) tries to load its UI from the
  `localhost:1420` dev server instead of the bundled frontend. Before
  `.visible(false)`, that failure was at least visible: a blank or
  connection-refused window. Now the window is created invisible and only
  shown once the frontend mounts and calls `.show()`; since a
  `custom-protocol`-less build never gets that far, the window silently
  never appears at all: process alive, 0% CPU, one 10×10 unmapped X window,
  looks exactly like a genuine hang. It happened twice in a row while
  building the About note feature, and was mistaken for a real startup-race
  bug both times before the actual cause (the wrong build command) was
  found. If a note window ever seems to hang on creation, check the build
  command before anything else.

## Icons

Source icons live in `icons/` (see `icons/README.md` for the palette and
design notes). `src-tauri/icons/` is generated from
`icons/io.github.you.Jotter.svg` via `npx tauri icon <path>`; rerun that
after editing the source SVG, rather than hand-editing the generated PNGs.

## License

MIT. See [LICENSE](LICENSE).
