#!/bin/zsh
# Builds the shared web UI (repo root) and the Swift app, then assembles
# macos/build/Jotter.app.
# Usage: macos/build.sh [--install]   (--install copies the app to /Applications)
set -euo pipefail

MACOS="${0:A:h}"
ROOT="${MACOS:h}"
APP="$MACOS/build/Jotter.app"

echo "==> Building web UI"
cd "$ROOT"
[[ -d node_modules ]] || npm ci
npm run build

echo "==> Building Swift app"
cd "$MACOS"
# A universal binary needs full Xcode (SwiftPM hands multi-arch builds to
# xcbuild); with only the Command Line Tools, build for this Mac's arch.
ARCHS=()
if xcodebuild -version >/dev/null 2>&1; then
  ARCHS=(--arch arm64 --arch x86_64)
fi
swift build -c release "${ARCHS[@]}"
BIN="$(swift build -c release "${ARCHS[@]}" --show-bin-path)/Jotter"

echo "==> Assembling $APP"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$BIN" "$APP/Contents/MacOS/Jotter"
cp "$MACOS/Resources/Info.plist" "$APP/Contents/Info.plist"
cp "$ROOT/src-tauri/icons/icon.icns" "$APP/Contents/Resources/AppIcon.icns"
cp -R "$ROOT/dist" "$APP/Contents/Resources/web"
codesign --force --sign - "$APP"

if [[ "${1:-}" == "--install" ]]; then
  echo "==> Installing to /Applications"
  rm -rf "/Applications/Jotter.app"
  cp -R "$APP" /Applications/
fi

echo "Done: $APP"
