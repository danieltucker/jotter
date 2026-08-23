# Jotter icons

Option 2e: yellow note over a tilted sage note, coral pin at the top-right corner.

## Files

- `io.github.you.Jotter.svg` — app icon, 128x128 nominal, scalable
- `io.github.you.Jotter-dark.svg` — dark-shell variant of the same mark
- `jotter-symbolic.svg` — 16x16 monochrome symbolic, one note + pin

Rename `io.github.you` to your real app ID before shipping.

## Install paths

App icon:

    /app/share/icons/hicolor/scalable/apps/io.github.you.Jotter.svg

Symbolic:

    /app/share/icons/hicolor/symbolic/apps/io.github.you.Jotter-symbolic.svg

Reference it from your desktop entry and appstream metadata with the bare app ID:

    Icon=io.github.you.Jotter

## Notes

- GNOME ships one app icon for both light and dark shells; the dark file is here in
  case you want it for a website, README, or a shell that supports icon theming.
  Do not install both under the same name.
- The symbolic uses `#222222`, which is what GTK's symbolic recolouring expects.
  It carries one note only — the stack does not survive a single stroke weight at 16px.
- Palette: note `#FFC93C`, back note `#7FBB9B`, pin `#E8613C`, pin stem `#3A2E28`,
  baseplate `#FFF6E3` (light) / `#20242B` (dark).
- Nothing is stroked with a scaled stroke, so the SVGs render cleanly at any size,
  but check 24px and 16px after any edit.
