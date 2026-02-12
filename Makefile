# Brain CLI
# Usage: make

INSTALL_PATH = $(HOME)/.local/bin

.PHONY: all clean

## all: Build the brain CLI and install to ~/.local/bin
all:
	@echo "Building brain CLI..."
	cd apps/tui && go build -o brain .
	mkdir -p $(INSTALL_PATH)
	cp apps/tui/brain $(INSTALL_PATH)/brain
	@echo ""
	@echo "Installed: $(INSTALL_PATH)/brain"
	@echo "Run 'brain install' to install to Claude Code / Cursor"

## clean: Remove build artifacts
clean:
	rm -f apps/tui/brain
