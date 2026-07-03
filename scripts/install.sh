#!/usr/bin/env bash
#
# Install komodo into a directory on your PATH.
#
#   ./scripts/install.sh              build from source, install to ~/.local/bin
#   PREFIX=/usr/local ./scripts/install.sh   install to /usr/local/bin (may need sudo)
#   ./scripts/install.sh --no-build   install the existing dist/ binary as-is
#
set -euo pipefail

BIN_NAME="komodo"
PREFIX="${PREFIX:-$HOME/.local}"
BIN_DIR="$PREFIX/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BUILD=1
[ "${1:-}" = "--no-build" ] && BUILD=0

if [ "$BUILD" -eq 1 ]; then
    if ! command -v bun >/dev/null 2>&1; then
        echo "error: bun is required to build $BIN_NAME — see https://bun.sh (or pass --no-build)" >&2
        exit 1
    fi
    echo "› building $BIN_NAME…"
    ( cd "$ROOT" && bun install >/dev/null 2>&1 || bun install )
    ( cd "$ROOT" && bun build src/cli.tsx --compile --outfile "dist/$BIN_NAME" )
fi

if [ ! -x "$ROOT/dist/$BIN_NAME" ]; then
    echo "error: $ROOT/dist/$BIN_NAME not found — run without --no-build to build it first" >&2
    exit 1
fi

echo "› installing → $BIN_DIR/$BIN_NAME"
mkdir -p "$BIN_DIR"
# Replace atomically and as a real copy (not a symlink) so it survives the repo
# moving/being deleted, and so a future self-update can swap the file in place.
install -m 0755 "$ROOT/dist/$BIN_NAME" "$BIN_DIR/$BIN_NAME.tmp.$$"
mv -f "$BIN_DIR/$BIN_NAME.tmp.$$" "$BIN_DIR/$BIN_NAME"

# Is BIN_DIR on PATH? If not, point the user at their shell rc.
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        rc="$HOME/.profile"
        case "${SHELL:-}" in
            *zsh) rc="$HOME/.zshrc" ;;
            *bash) rc="$HOME/.bashrc" ;;
        esac
        echo
        echo "note: $BIN_DIR is not on your PATH. Add it, e.g.:"
        echo "      echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> $rc && source $rc"
        ;;
esac

echo "› installed $("$BIN_DIR/$BIN_NAME" --version 2>/dev/null | head -1 || echo "$BIN_NAME")"
