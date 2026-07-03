#!/bin/sh
# komodo installer — downloads a prebuilt binary onto your PATH. No repo or
# toolchain needed. Meant to be hosted and piped:
#
#   curl -fsSL https://raw.githubusercontent.com/OWNER/komodo/main/install.sh | sh
#
# Env overrides:
#   KOMODO_REPO=owner/repo   GitHub repo to install from (default below)
#   KOMODO_VERSION=v1.2.3    specific tag to install     (default: latest)
#   PREFIX=/usr/local        install prefix              (default: ~/.local) -> $PREFIX/bin
set -eu

REPO="${KOMODO_REPO:-xtrimsystems/komodo}" # GitHub owner/repo (override with KOMODO_REPO)
VERSION="${KOMODO_VERSION:-latest}"
PREFIX="${PREFIX:-$HOME/.local}"
BIN="komodo"
BIN_DIR="$PREFIX/bin"

# --- platform detection -----------------------------------------------------
os=$(uname -s)
arch=$(uname -m)
case "$os" in
    Linux) os=linux ;;
    Darwin) os=darwin ;;
    *) echo "komodo: unsupported OS '$os'" >&2; exit 1 ;;
esac
case "$arch" in
    x86_64 | amd64) arch=x64 ;;
    aarch64 | arm64) arch=arm64 ;;
    *) echo "komodo: unsupported architecture '$arch'" >&2; exit 1 ;;
esac
asset="${BIN}-${os}-${arch}"

# --- resolve download URL (the /latest/download/ path redirects, no API) ----
base="https://github.com/$REPO/releases"
if [ "$VERSION" = latest ]; then
    url="$base/latest/download/$asset"
else
    url="$base/download/$VERSION/$asset"
fi

fetch() { # <url> <outfile>
    if command -v curl >/dev/null 2>&1; then
        curl -fSL --progress-bar "$1" -o "$2"
    elif command -v wget >/dev/null 2>&1; then
        wget -q -O "$2" "$1"
    else
        echo "komodo: need curl or wget to download" >&2
        exit 1
    fi
}

mkdir -p "$BIN_DIR"
tmp=$(mktemp "$BIN_DIR/.$BIN.XXXXXX") # same fs as target -> atomic rename
trap 'rm -f "$tmp" "$tmp.sha256"' EXIT

echo "› downloading $asset ($VERSION)…"
fetch "$url" "$tmp"

# --- verify checksum when the release publishes one -------------------------
if fetch "$url.sha256" "$tmp.sha256" 2>/dev/null; then
    expected=$(awk '{print $1}' "$tmp.sha256")
    if command -v sha256sum >/dev/null 2>&1; then
        actual=$(sha256sum "$tmp" | awk '{print $1}')
    elif command -v shasum >/dev/null 2>&1; then
        actual=$(shasum -a 256 "$tmp" | awk '{print $1}')
    else
        actual=""
    fi
    if [ -n "$actual" ] && [ "$actual" != "$expected" ]; then
        echo "komodo: checksum mismatch — refusing to install" >&2
        exit 1
    fi
fi

chmod +x "$tmp"
mv -f "$tmp" "$BIN_DIR/$BIN"
echo "› installed → $BIN_DIR/$BIN"

# --- PATH check -------------------------------------------------------------
case ":$PATH:" in
    *":$BIN_DIR:"*) ;;
    *)
        rc="$HOME/.profile"
        case "${SHELL:-}" in
            *zsh) rc="$HOME/.zshrc" ;;
            *bash) rc="$HOME/.bashrc" ;;
        esac
        echo
        echo "note: $BIN_DIR is not on your PATH. Add it:"
        echo "      echo 'export PATH=\"$BIN_DIR:\$PATH\"' >> $rc && . $rc"
        ;;
esac

"$BIN_DIR/$BIN" --version 2>/dev/null | head -1 || true
