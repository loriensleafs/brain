# Brain

A knowledge graph and AI agent orchestration system for Claude Code and Cursor.

Brain provides agents, skills, commands, hooks, and MCP server configuration that install into your AI coding tools. It includes a TUI for managing your knowledge graph, semantic search, and session lifecycle.

## Install

```sh
curl -fsSL https://raw.githubusercontent.com/loriensleafs/brain/main/install.sh | sh
```

This downloads the latest release binary for your platform (macOS/Linux, amd64/arm64) and installs it to `~/.local/bin/brain`.

### Requirements

- [bun](https://bun.sh) is required for Brain's MCP server and hook scripts
- Ensure `~/.local/bin` is in your `PATH`

### Install to your AI tools

After installing the binary, run:

```sh
brain install
```

This opens an interactive prompt to select which tools to install Brain for (Claude Code, Cursor). Brain installs non-destructively and never modifies your existing configuration files.

### Upgrade

```sh
brain upgrade         # Download and install latest release
brain upgrade --check # Check for updates without installing
```

## Usage

```
brain                 # Launch interactive TUI
brain install         # Install to Claude Code / Cursor
brain uninstall       # Remove from selected tools
brain upgrade         # Self-update to latest release
brain claude          # Launch Claude Code with Brain loaded
brain cursor          # Launch Cursor with Brain loaded
brain search <query>  # Search the knowledge base
brain session         # Manage session state
brain config          # Manage Brain configuration
brain projects        # Manage Brain memory projects
```

Run `brain --help` for the full command list.

## Development

Requires Go 1.23+ and [bun](https://bun.sh).

```sh
make                  # Build and install to ~/.local/bin
make clean            # Remove build artifacts
```
