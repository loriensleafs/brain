# Brain CLI
# Usage: make

INSTALL_PATH = $(HOME)/.local/bin

.PHONY: all clean embed

## embed: Copy templates into apps/tui/embedded/ for go:embed
embed:
	@echo "Copying templates for embedding..."
	rm -rf apps/tui/embedded/templates
	cp -R templates apps/tui/embedded/templates
	@# Remove .DS_Store and .gitkeep files that shouldn't be embedded
	find apps/tui/embedded/templates -name '.DS_Store' -delete
	find apps/tui/embedded/templates -name '.gitkeep' -delete

## all: Build the brain CLI and install to ~/.local/bin
all: embed
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
	rm -rf apps/tui/embedded/templates
