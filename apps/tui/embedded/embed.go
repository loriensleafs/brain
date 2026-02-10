// Package embedded provides embedded template files for the Brain CLI.
//
// The templates/ directory is copied from the repo root into apps/tui/embedded/
// at build time (see Makefile "embed" target). This allows go:embed to
// compile the entire template tree into the binary.
//
// When running from a development checkout (project root found via
// brain.config.json), the CLI uses the real filesystem. When running
// from an installed binary, it falls back to the embedded FS.
package embedded

import (
	"embed"
	"io/fs"
)

//go:embed all:templates
var content embed.FS

// FS returns an fs.FS rooted at the templates/ directory.
// Callers can use fs.ReadFile(FS(), "brain.config.json") etc.
func FS() fs.FS {
	sub, err := fs.Sub(content, "templates")
	if err != nil {
		panic("embedded templates missing: " + err.Error())
	}
	return sub
}
