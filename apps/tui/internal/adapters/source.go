package adapters

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// TemplateSource abstracts reading template files from either the real
// filesystem (development) or an embedded fs.FS (installed binary).
type TemplateSource struct {
	// embedded is the fs.FS for reading from embedded templates.
	// When nil, all reads go to the real filesystem via projectRoot.
	embedded fs.FS

	// projectRoot is the absolute path to the Brain project root.
	// Used for real-filesystem reads and for resolving paths that
	// go:embed cannot handle (e.g., absolute path resolution in MCP config).
	projectRoot string
}

// NewFilesystemSource creates a TemplateSource that reads from the real filesystem.
func NewFilesystemSource(projectRoot string) *TemplateSource {
	return &TemplateSource{projectRoot: projectRoot}
}

// NewEmbeddedSource creates a TemplateSource that reads from an embedded fs.FS.
// projectRoot is still needed for path resolution in output files.
func NewEmbeddedSource(embedded fs.FS, projectRoot string) *TemplateSource {
	return &TemplateSource{embedded: embedded, projectRoot: projectRoot}
}

// IsEmbedded returns true if this source reads from embedded templates.
func (s *TemplateSource) IsEmbedded() bool {
	return s.embedded != nil
}

// ProjectRoot returns the project root path.
func (s *TemplateSource) ProjectRoot() string {
	return s.projectRoot
}

// TemplatesDir returns the absolute path to the templates directory
// on the real filesystem. Only meaningful for filesystem sources.
func (s *TemplateSource) TemplatesDir() string {
	return filepath.Join(s.projectRoot, "templates")
}

// ReadFile reads a file relative to the templates directory.
// relPath should use forward slashes (e.g., "configs/brain.config.json").
func (s *TemplateSource) ReadFile(relPath string) ([]byte, error) {
	if s.embedded != nil {
		return fs.ReadFile(s.embedded, relPath)
	}
	return os.ReadFile(filepath.Join(s.projectRoot, "templates", relPath))
}

// ReadDir reads a directory relative to the templates directory.
func (s *TemplateSource) ReadDir(relPath string) ([]fs.DirEntry, error) {
	if s.embedded != nil {
		return fs.ReadDir(s.embedded, relPath)
	}
	return os.ReadDir(filepath.Join(s.projectRoot, "templates", relPath))
}

// WalkDir walks a directory relative to the templates directory.
func (s *TemplateSource) WalkDir(relPath string, fn fs.WalkDirFunc) error {
	if s.embedded != nil {
		return fs.WalkDir(s.embedded, relPath, fn)
	}
	absDir := filepath.Join(s.projectRoot, "templates", relPath)
	return filepath.WalkDir(absDir, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return fn(path, d, err)
		}
		// Convert absolute path back to relative for consistency
		rel, relErr := filepath.Rel(absDir, path)
		if relErr != nil {
			return fn(path, d, relErr)
		}
		// Normalize to forward slashes for cross-platform consistency
		rel = filepath.ToSlash(rel)
		if relPath != "." {
			rel = relPath + "/" + rel
			// Clean double slashes from root entry
			if strings.HasSuffix(rel, "/.") {
				rel = strings.TrimSuffix(rel, "/.")
			}
		}
		return fn(rel, d, err)
	})
}

// Stat checks if a path exists relative to the templates directory.
func (s *TemplateSource) Stat(relPath string) (fs.FileInfo, error) {
	if s.embedded != nil {
		return fs.Stat(s.embedded, relPath)
	}
	return os.Stat(filepath.Join(s.projectRoot, "templates", relPath))
}

// Exists returns true if the path exists.
func (s *TemplateSource) Exists(relPath string) bool {
	_, err := s.Stat(relPath)
	return err == nil
}
