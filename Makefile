.PHONY: all build build-all build-mcp build-tui build-plugin build-plugin-hooks mcp tui plugin install install-tui uninstall-tui install-plugin install-plugin-cache install-plugin-full uninstall-plugin clean-plugin-cache reinstall-plugin reinstall-plugin-full dev clean

# Paths
INSTALL_PATH = $(HOME)/.local/bin
BINARY_NAME = brain
PLUGIN_PATH = $(HOME)/.claude/plugins/brain
PLUGIN_SRC = $(PWD)/apps/claude-plugin
PLUGIN_CACHE_PATH = $(HOME)/.claude/plugins/cache/brain

# Default target - build all apps
all: build-all
build: build-all
build-all: build-tui build-plugin
	@echo "🧠 Building all TypeScript packages (via Turborepo)..."
	bun run build
	@echo "🧠 All components built"

#############################################################################
# MCP Server (TypeScript/Bun)
#############################################################################

mcp: build-mcp
build-mcp:
	@echo "🧠 Building MCP server (via Turborepo)..."
	bun run build --filter=@brain/mcp
	@echo "🧠 MCP server built"

mcp-dev:
	cd apps/mcp && bun run dev

mcp-http:
	cd apps/mcp && bun run start:http

#############################################################################
# TUI Binary (Go)
#############################################################################

tui: build-tui
build-tui:
	@echo "🧠 Building TUI..."
	cd apps/tui && go build -o $(BINARY_NAME) .
	@echo "🧠 TUI built: apps/tui/$(BINARY_NAME)"

# Install TUI to ~/.local/bin with brain, think, and thinking commands
install-tui: build-tui
	@echo "🧠 Installing TUI commands..."
	mkdir -p $(INSTALL_PATH)
	cp apps/tui/$(BINARY_NAME) $(INSTALL_PATH)/brain
	ln -sf $(INSTALL_PATH)/brain $(INSTALL_PATH)/think
	ln -sf $(INSTALL_PATH)/brain $(INSTALL_PATH)/thinking
	@echo "🧠 Installed: brain, think, thinking"
	@echo "🧠 Ensure $(INSTALL_PATH) is in your PATH"

# Uninstall TUI
uninstall-tui:
	rm -f $(INSTALL_PATH)/brain $(INSTALL_PATH)/think $(INSTALL_PATH)/thinking
	@echo "🧠 Uninstalled: brain, think, thinking"

#############################################################################
# Claude Plugin
#############################################################################

plugin: build-plugin

# Build Go hooks binary
build-plugin-hooks:
	@echo "Building plugin hooks binary..."
	cd apps/claude-plugin && go build -o hooks/scripts/brain-hooks ./cmd/hooks
	@echo "Hooks binary built: apps/claude-plugin/hooks/scripts/brain-hooks"

# Build plugin (compiles hooks binary)
build-plugin: build-plugin-hooks
	@echo "Plugin hooks built and ready for install"

# Install Claude plugin via symlinks for development
# Use ln -sfn to avoid creating symlinks inside existing symlinked directories
install-plugin:
	mkdir -p $(PLUGIN_PATH)
	ln -sfn $(PLUGIN_SRC)/.claude-plugin $(PLUGIN_PATH)/.claude-plugin
	ln -sfn $(PLUGIN_SRC)/mcp.json $(PLUGIN_PATH)/mcp.json
	ln -sfn $(PLUGIN_SRC)/agents $(PLUGIN_PATH)/agents
	ln -sfn $(PLUGIN_SRC)/hooks $(PLUGIN_PATH)/hooks
	ln -sfn $(PLUGIN_SRC)/commands $(PLUGIN_PATH)/commands
	ln -sfn $(PLUGIN_SRC)/skills $(PLUGIN_PATH)/skills
	@echo "🧠 Plugin installed to $(PLUGIN_PATH)"

# Uninstall Claude plugin
uninstall-plugin:
	rm -rf $(PLUGIN_PATH)
	@echo "Plugin uninstalled"

# Install plugin to cache directory (replacing existing)
install-plugin-cache:
	@echo "Installing plugin to cache..."
	rm -rf $(PLUGIN_CACHE_PATH)
	mkdir -p $(PLUGIN_CACHE_PATH)/brain/1.0.0
	cp -R apps/claude-plugin/.claude-plugin $(PLUGIN_CACHE_PATH)/brain/1.0.0/
	cp -R apps/claude-plugin/agents $(PLUGIN_CACHE_PATH)/brain/1.0.0/
	cp -R apps/claude-plugin/commands $(PLUGIN_CACHE_PATH)/brain/1.0.0/
	cp -R apps/claude-plugin/hooks $(PLUGIN_CACHE_PATH)/brain/1.0.0/
	cp -R apps/claude-plugin/skills $(PLUGIN_CACHE_PATH)/brain/1.0.0/
	cp apps/claude-plugin/mcp.json $(PLUGIN_CACHE_PATH)/brain/1.0.0/
	@echo "Plugin cache installed to $(PLUGIN_CACHE_PATH)"

# Install both symlinks and cache
install-plugin-full: build-plugin install-plugin install-plugin-cache
	@echo "Plugin fully installed (symlinks + cache)"

# Clean plugin cache
clean-plugin-cache:
	rm -rf $(PLUGIN_CACHE_PATH)
	@echo "Plugin cache cleared"

# Complete fresh reinstall: clean everything, rebuild, and reinstall (symlinks only)
reinstall-plugin: uninstall-plugin clean-plugin-cache clean mcp build-all install-tui install-plugin
	@echo "Plugin completely reinstalled from scratch"
	@echo "Restart Claude Code to load the fresh plugin"

# Complete rebuild and reinstall (symlinks + cache)
reinstall-plugin-full: uninstall-plugin clean-plugin-cache clean build-all install-tui install-plugin install-plugin-cache
	@echo "Plugin completely reinstalled from scratch (symlinks + cache)"
	@echo "Restart Claude Code to load the fresh plugin"

# Install all dependencies
install:
	cd apps/mcp && bun install

# Full install (MCP deps + TUI binary + Claude plugin)
install-all: install install-tui install-plugin

# Development mode
dev: mcp-dev

# Clean build artifacts
clean:
	@echo "🧹 Cleaning build artifacts..."
	bun run clean
	rm -f apps/tui/$(BINARY_NAME)
	@echo "🧹 Clean complete"

# Type checking
typecheck:
	cd apps/mcp && bun run typecheck
