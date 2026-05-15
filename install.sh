#!/usr/bin/env bash
# Aether installer / updater for macOS (Apple Silicon).
#
# Usage (run from anywhere):
#   bash <(curl -fsSL https://raw.githubusercontent.com/TongWu021/aether/main/install.sh)
#
# What it does (idempotent — same script for first install and updates):
#   1. Asks GitHub for the latest release of TongWu021/aether
#   2. Downloads the .dmg into a temp dir
#   3. Mounts it, copies Aether.app into /Applications (overwriting any old copy)
#   4. Unmounts the .dmg, removes the macOS quarantine flag (unsigned app workaround)
#   5. Cleans up temp files
#
# Requires: curl, hdiutil, jq is NOT required (we parse JSON with grep/sed).

set -euo pipefail

REPO="TongWu021/aether"
APP_NAME="Aether"
INSTALL_DIR="/Applications"

# --- preflight ---
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "❌ This installer is macOS only. Detected: $(uname -s)" >&2
  exit 1
fi

ARCH="$(uname -m)"
if [[ "$ARCH" != "arm64" ]]; then
  echo "⚠️  Aether currently ships arm64-only builds (Apple Silicon)." >&2
  echo "    Your Mac reports: $ARCH (Intel). Tell the developer if you need an x64 build." >&2
  exit 1
fi

# --- fetch latest release metadata ---
echo "→ Querying latest release from github.com/${REPO}..."
RELEASE_JSON="$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest")"

TAG="$(printf '%s' "$RELEASE_JSON" | grep -m1 '"tag_name"' | sed -E 's/.*"tag_name":[[:space:]]*"([^"]+)".*/\1/')"
DMG_URL="$(printf '%s' "$RELEASE_JSON" \
  | grep -E '"browser_download_url"' \
  | grep -E '\.dmg"' \
  | grep -E 'arm64' \
  | head -1 \
  | sed -E 's/.*"browser_download_url":[[:space:]]*"([^"]+)".*/\1/')"

if [[ -z "${TAG:-}" || -z "${DMG_URL:-}" ]]; then
  echo "❌ Couldn't find an arm64 .dmg in the latest release. Maybe the release doesn't have one yet." >&2
  exit 1
fi

echo "→ Latest version: ${TAG}"
echo "→ Asset: ${DMG_URL##*/}"

# --- download dmg ---
TMP_DIR="$(mktemp -d -t aether-install)"
trap 'rm -rf "$TMP_DIR"' EXIT
DMG_PATH="${TMP_DIR}/aether.dmg"

echo "→ Downloading..."
curl -fL --progress-bar -o "$DMG_PATH" "$DMG_URL"

# --- close existing Aether if running (otherwise cp -R will warn but still work) ---
if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
  echo "→ Closing running ${APP_NAME}..."
  osascript -e "tell application \"${APP_NAME}\" to quit" 2>/dev/null || true
  # give it a moment
  for _ in 1 2 3 4 5; do
    if ! pgrep -x "$APP_NAME" >/dev/null 2>&1; then break; fi
    sleep 1
  done
fi

# --- mount dmg ---
echo "→ Mounting dmg..."
MOUNT_INFO="$(hdiutil attach "$DMG_PATH" -nobrowse -noautoopen -plist)"
MOUNT_POINT="$(printf '%s' "$MOUNT_INFO" \
  | grep -A1 '<key>mount-point</key>' \
  | tail -1 \
  | sed -E 's/.*<string>([^<]+)<\/string>.*/\1/')"

if [[ -z "${MOUNT_POINT:-}" || ! -d "$MOUNT_POINT" ]]; then
  echo "❌ Failed to mount dmg." >&2
  exit 1
fi

# --- copy app ---
SRC_APP="${MOUNT_POINT}/${APP_NAME}.app"
DEST_APP="${INSTALL_DIR}/${APP_NAME}.app"

if [[ ! -d "$SRC_APP" ]]; then
  echo "❌ ${APP_NAME}.app not found inside dmg." >&2
  hdiutil detach "$MOUNT_POINT" -quiet || true
  exit 1
fi

echo "→ Installing to ${DEST_APP}..."
rm -rf "$DEST_APP"
cp -R "$SRC_APP" "$INSTALL_DIR/"

echo "→ Unmounting dmg..."
hdiutil detach "$MOUNT_POINT" -quiet || true

# --- strip quarantine attribute (unsigned app workaround for Gatekeeper) ---
echo "→ Removing quarantine attribute..."
xattr -dr com.apple.quarantine "$DEST_APP" 2>/dev/null || true

echo ""
echo "✅ ${APP_NAME} ${TAG} installed at ${DEST_APP}"
echo "   Open from Launchpad or run: open -a ${APP_NAME}"
