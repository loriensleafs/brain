# Brain Monorepo Makefile
# ============================================================================
# Self-documenting Makefile - use `make help` to see available targets

#############################################################################
# .PHONY Declarations (grouped by category)
#############################################################################

# Install targets (7)
.PHONY: install install-typescript install-go install-plugin install-mcp
.PHONY: install-tui install-packages

# Uninstall targets (2)
.PHONY: uninstall-plugin uninstall-tui

# Reinstall targets (1)
.PHONY: reinstall-plugin

# Clean targets (8)
.PHONY: clean clean-deps clean-go clean-typescript clean-plugin clean-mcp
.PHONY: clean-tui clean-packages

# Build targets (5)
.PHONY: build build-plugin build-mcp build-tui build-packages

# MCP targets (4)
.PHONY: mcp-start mcp-stop mcp-restart mcp-status

# Utility targets (2)
.PHONY: typecheck help

#############################################################################
# Path Variables
#############################################################################

INSTALL_PATH = $(HOME)/.local/bin
BINARY_NAME = brain
PLUGIN_PATH = $(HOME)/.claude/plugins/brain
PLUGIN_SRC = $(PWD)/apps/claude-plugin
PLUGIN_CACHE_PATH = $(HOME)/.claude/plugins/cache/brain
INSTRUCTIONS_SRC = $(PLUGIN_SRC)/instructions
AGENTS_DIR = $(HOME)/.agents

# Go module locations
GO_MODULES = apps/tui apps/claude-plugin packages/validation packages/utils

#############################################################################
# Default Target
#############################################################################

## all: Build all components (default)
all: build

#############################################################################
# Install Targets (7)
#############################################################################

## install: Install all deps for entire codebase (TS + Go)
install: install-typescript install-go

## install-typescript: Install all TS deps via bun workspaces
install-typescript:
	@echo "Installing TypeScript dependencies..."
	bun install
	@echo "TypeScript dependencies installed"

## install-go: Install all Go deps for static module list
install-go:
	@echo "Downloading Go dependencies..."
	@for mod in $(GO_MODULES); do \
		echo "  - $$mod"; \
		(cd $$mod && go mod download); \
	done
	@echo "Go dependencies downloaded"

## install-plugin: Install plugin with deps, builds, and symlinks
install-plugin: install-typescript install-go
	@echo "Building MCP dependencies for plugin..."
	bun run build --filter=@brain/mcp
	@echo "Building plugin hooks binary..."
	cd apps/claude-plugin && go build -o hooks/scripts/brain-hooks ./cmd/hooks
	@echo ""
	@echo "Installing Claude plugin via symlinks..."
	mkdir -p $(PLUGIN_PATH)
	mkdir -p $(PLUGIN_PATH)/agents
	mkdir -p $(PLUGIN_PATH)/commands
	ln -sfn $(PLUGIN_SRC)/.claude-plugin $(PLUGIN_PATH)/.claude-plugin
	ln -sfn $(PLUGIN_SRC)/mcp.json $(PLUGIN_PATH)/mcp.json
	ln -sfn $(PLUGIN_SRC)/skills $(PLUGIN_PATH)/skills
	ln -sfn $(PLUGIN_SRC)/hooks $(PLUGIN_PATH)/hooks
	@echo "  Symlinking first-level agent files..."
	@for f in $(PLUGIN_SRC)/agents/*.md; do \
		[ -f "$$f" ] && ln -sfn "$$f" $(PLUGIN_PATH)/agents/; \
	done
	@echo "  Symlinking first-level command files..."
	@for f in $(PLUGIN_SRC)/commands/*.md; do \
		[ -f "$$f" ] && ln -sfn "$$f" $(PLUGIN_PATH)/commands/; \
	done
	@echo "Plugin installed to $(PLUGIN_PATH)"
	@echo ""
	@echo "Installing instruction symlinks..."
	mkdir -p $(AGENTS_DIR)
	ln -sfn $(INSTRUCTIONS_SRC)/AGENTS.md $(HOME)/AGENTS.md
	ln -sfn $(INSTRUCTIONS_SRC)/AGENTS.md $(HOME)/CLAUDE.md
	@echo "  Symlinking protocol files..."
	@for f in $(INSTRUCTIONS_SRC)/protocols/*.md; do \
		[ -f "$$f" ] && ln -sfn "$$f" $(AGENTS_DIR)/; \
	done
	@echo "Instruction symlinks installed:"
	@echo "  ~/AGENTS.md -> $(INSTRUCTIONS_SRC)/AGENTS.md"
	@echo "  ~/CLAUDE.md -> $(INSTRUCTIONS_SRC)/AGENTS.md"
	@echo "  ~/.agents/*.md -> $(INSTRUCTIONS_SRC)/protocols/*.md"
	@echo ""
	@echo "Restarting MCP server..."
	-brain mcp restart 2>/dev/null || echo "Warning: Could not restart MCP (brain command may not be installed)"
	@echo "Plugin installation complete"

## install-mcp: Install deps + build MCP via turbo
install-mcp: install-typescript
	@echo "Building MCP via Turborepo..."
	bun run build --filter=@brain/mcp
	@echo "MCP installed and built"

## install-tui: Install deps + build TUI + install to ~/.local/bin
install-tui: install-go
	@echo "Building TUI..."
	cd apps/tui && go build -o $(BINARY_NAME) .
	@echo "Installing TUI commands..."
	mkdir -p $(INSTALL_PATH)
	cp apps/tui/$(BINARY_NAME) $(INSTALL_PATH)/brain
	ln -sfn $(INSTALL_PATH)/brain $(INSTALL_PATH)/think
	ln -sfn $(INSTALL_PATH)/brain $(INSTALL_PATH)/thinking
	@echo "Installed: brain, think, thinking to $(INSTALL_PATH)"
	@echo "Ensure $(INSTALL_PATH) is in your PATH"

## install-packages: Install deps in /packages/**
install-packages: install-typescript
	@echo "Packages installed (handled by bun workspaces)"

#############################################################################
# Uninstall Targets (2)
#############################################################################

## uninstall-plugin: Remove all plugin files and instruction symlinks
uninstall-plugin:
	@echo "Uninstalling plugin..."
	rm -rf $(PLUGIN_PATH)
	rm -rf $(PLUGIN_CACHE_PATH)
	@echo "Removing instruction symlinks..."
	rm -f $(HOME)/AGENTS.md
	rm -f $(HOME)/CLAUDE.md
	rm -rf $(AGENTS_DIR)
	@echo "Plugin and instruction symlinks completely removed"

## uninstall-tui: Remove TUI binaries from ~/.local/bin
uninstall-tui:
	rm -f $(INSTALL_PATH)/brain $(INSTALL_PATH)/think $(INSTALL_PATH)/thinking
	@echo "Uninstalled: brain, think, thinking"

#############################################################################
# Reinstall Targets (1)
#############################################################################

## reinstall-plugin: Uninstall, install, and restart MCP
reinstall-plugin: uninstall-plugin install-plugin
	@echo "Plugin reinstalled and MCP restarted"

#############################################################################
# Clean Targets (8)
#############################################################################

## clean: Clean all deps, caches, build artifacts recursively
clean: clean-deps clean-go clean-typescript clean-plugin clean-mcp clean-tui clean-packages
	@echo "All build artifacts and caches cleaned"

## clean-deps: Clean all TS and Go deps/caches
clean-deps: clean-typescript clean-go

## clean-go: Clean Go build cache for all modules
clean-go:
	@echo "Cleaning Go build cache..."
	go clean -cache
	@for mod in $(GO_MODULES); do \
		echo "  Cleaning $$mod"; \
		(cd $$mod && go clean); \
	done
	@echo "Go build cache cleaned"

## clean-typescript: Clean node_modules, dist, .turbo recursively
clean-typescript:
	@echo "Cleaning TypeScript artifacts..."
	rm -rf node_modules
	rm -rf apps/*/node_modules
	rm -rf packages/*/node_modules
	rm -rf .turbo
	rm -rf apps/*/.turbo
	rm -rf packages/*/.turbo
	rm -rf apps/*/dist
	rm -rf packages/*/dist
	@echo "TypeScript artifacts cleaned (node_modules, dist, .turbo)"

## clean-plugin: Clean deps/caches/dists in plugin, remove hooks binary
clean-plugin:
	@echo "Cleaning plugin artifacts..."
	rm -rf apps/claude-plugin/node_modules
	rm -rf apps/claude-plugin/dist
	rm -rf apps/claude-plugin/.turbo
	rm -f apps/claude-plugin/hooks/scripts/brain-hooks
	@echo "Plugin artifacts cleaned"

## clean-mcp: Clean deps/caches/dists in MCP
clean-mcp:
	@echo "Cleaning MCP artifacts..."
	rm -rf apps/mcp/node_modules
	rm -rf apps/mcp/dist
	rm -rf apps/mcp/.turbo
	@echo "MCP artifacts cleaned"

## clean-tui: Clean deps/caches/dists in TUI, remove binary
clean-tui:
	@echo "Cleaning TUI artifacts..."
	rm -f apps/tui/$(BINARY_NAME)
	@echo "TUI artifacts cleaned"

## clean-packages: Clean deps/caches/dists in packages
clean-packages:
	@echo "Cleaning package artifacts..."
	rm -rf packages/*/node_modules
	rm -rf packages/*/dist
	rm -rf packages/*/.turbo
	@echo "Package artifacts cleaned"

#############################################################################
# Build Targets (5)
#############################################################################

## build: Install deps then build everything (turbo + Go binaries)
build: install
	@echo "Building TypeScript packages via Turborepo..."
	bun run build
	@echo "Building Go binaries..."
	cd apps/tui && go build -o $(BINARY_NAME) .
	cd apps/claude-plugin && go build -o hooks/scripts/brain-hooks ./cmd/hooks
	@echo "All components built"

## build-plugin: Install plugin deps then build hooks binary
build-plugin: install-plugin
	@echo "Plugin built (hooks binary ready)"

## build-mcp: Install MCP deps then build via turbo
build-mcp: install-mcp
	@echo "MCP built"

## build-tui: Install TUI deps then build binary
build-tui: install-tui
	@echo "TUI built and installed"

## build-packages: Install package deps then build via turbo
build-packages: install-packages
	@echo "Building packages via Turborepo..."
	bun run build --filter='./packages/*'
	@echo "Packages built"

#############################################################################
# MCP Targets (4)
#############################################################################

## mcp-start: Start MCP server
mcp-start:
	brain mcp start

## mcp-stop: Stop MCP server
mcp-stop:
	brain mcp stop

## mcp-restart: Restart MCP server
mcp-restart:
	brain mcp restart

## mcp-status: Check MCP server status
mcp-status:
	brain mcp status

#############################################################################
# Utility Targets (2)
#############################################################################

## typecheck: Run TypeScript type checking via turbo
typecheck:
	bun run typecheck

## help: Display available targets with descriptions
help:
	@echo "Brain Monorepo - Available Targets"
	@echo "============================================================================"
	@echo ""
	@echo "INSTALL TARGETS (7):"
	@grep -E '^## install' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "UNINSTALL TARGETS (2):"
	@grep -E '^## uninstall' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "REINSTALL TARGETS (1):"
	@grep -E '^## reinstall' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "CLEAN TARGETS (8):"
	@grep -E '^## clean' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "BUILD TARGETS (5):"
	@grep -E '^## build' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "MCP TARGETS (4):"
	@grep -E '^## mcp-' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "UTILITY TARGETS (2):"
	@grep -E '^## (typecheck|help|all)' $(MAKEFILE_LIST) | sed 's/## /  /' | sort
	@echo ""
	@echo "============================================================================"
	@echo "Usage: make <target>"
	@echo "Default target: all (builds everything)"
