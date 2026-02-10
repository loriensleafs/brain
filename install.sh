#!/bin/sh
# Brain CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/peterkloss/brain/main/install.sh | sh
set -e

REPO="loriensleafs/brain"
INSTALL_DIR="${BRAIN_INSTALL_DIR:-$HOME/.local/bin}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BOLD='\033[1m'
RESET='\033[0m'

info() { printf "${GREEN}%s${RESET}\n" "$1"; }
warn() { printf "${YELLOW}%s${RESET}\n" "$1"; }
error() { printf "${RED}%s${RESET}\n" "$1" >&2; exit 1; }

# Detect platform
detect_platform() {
  OS=$(uname -s | tr '[:upper:]' '[:lower:]')
  ARCH=$(uname -m)

  case "$OS" in
    darwin|linux) ;;
    *) error "Unsupported OS: $OS (only macOS and Linux are supported)" ;;
  esac

  case "$ARCH" in
    x86_64|amd64) ARCH="amd64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) error "Unsupported architecture: $ARCH" ;;
  esac

  PLATFORM="${OS}-${ARCH}"
}

# Get latest release version
get_version() {
  if [ -n "$BRAIN_VERSION" ]; then
    VERSION="$BRAIN_VERSION"
    return
  fi

  VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" 2>/dev/null \
    | grep '"tag_name"' \
    | head -1 \
    | cut -d'"' -f4)

  if [ -z "$VERSION" ]; then
    error "Could not determine latest version. Set BRAIN_VERSION to install a specific version."
  fi
}

# Download and install binary
install_binary() {
  URL="https://github.com/${REPO}/releases/download/${VERSION}/brain-${PLATFORM}"

  info "Downloading brain ${VERSION} for ${PLATFORM}..."

  TMPFILE=$(mktemp)
  trap 'rm -f "$TMPFILE"' EXIT

  HTTP_CODE=$(curl -fsSL -w '%{http_code}' -o "$TMPFILE" "$URL" 2>/dev/null || true)

  if [ "$HTTP_CODE" != "200" ]; then
    error "Download failed (HTTP $HTTP_CODE). Check that ${VERSION} has a binary for ${PLATFORM}."
  fi

  chmod +x "$TMPFILE"
  mkdir -p "$INSTALL_DIR"
  mv "$TMPFILE" "$INSTALL_DIR/brain"
  trap - EXIT

  info "Installed brain to ${INSTALL_DIR}/brain"
}

# Check if bun is installed (required for MCP server and hooks)
check_bun() {
  if ! command -v bun >/dev/null 2>&1; then
    warn ""
    warn "bun is required for Brain's MCP server and hook scripts."
    warn "Install it: curl -fsSL https://bun.sh/install | bash"
    warn ""
  fi
}

# Check PATH
check_path() {
  case ":$PATH:" in
    *":$INSTALL_DIR:"*) ;;
    *)
      warn ""
      warn "Add ${INSTALL_DIR} to your PATH:"
      warn "  export PATH=\"${INSTALL_DIR}:\$PATH\""
      warn ""
      ;;
  esac
}

# Main
main() {
  printf "${BOLD}Brain CLI Installer${RESET}\n\n"

  detect_platform
  get_version
  install_binary
  check_bun
  check_path

  printf "\n${BOLD}Next steps:${RESET}\n"
  printf "  brain install    # Install to Claude Code / Cursor\n"
  printf "  brain --help     # See all commands\n"
}

main
