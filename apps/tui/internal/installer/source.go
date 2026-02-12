package installer

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
)

// TemplateSource reads template files from the filesystem.
// In development, projectRoot points to the repo checkout.
// For installed binaries, it points to the XDG data directory
// (~/.local/share/brain) where the install script places templates.
type TemplateSource struct {
	// projectRoot is the absolute path to the directory containing
	// brain.config.json and templates/.
	projectRoot string
}

// NewFilesystemSource creates a TemplateSource that reads from the given root.
func NewFilesystemSource(projectRoot string) *TemplateSource {
	return &TemplateSource{projectRoot: projectRoot}
}

// ProjectRoot returns the project root path.
func (s *TemplateSource) ProjectRoot() string {
	return s.projectRoot
}

// TemplatesDir returns the absolute path to the templates directory.
func (s *TemplateSource) TemplatesDir() string {
	return filepath.Join(s.projectRoot, "templates")
}

// ReadFile reads a file relative to the templates directory.
// relPath should use forward slashes (e.g., "brain.config.json").
func (s *TemplateSource) ReadFile(relPath string) ([]byte, error) {
	return os.ReadFile(filepath.Join(s.projectRoot, "templates", relPath))
}

// ReadDir reads a directory relative to the templates directory.
func (s *TemplateSource) ReadDir(relPath string) ([]os.DirEntry, error) {
	return os.ReadDir(filepath.Join(s.projectRoot, "templates", relPath))
}

// WalkDir walks a directory relative to the templates directory.
func (s *TemplateSource) WalkDir(relPath string, fn fs.WalkDirFunc) error {
	absDir := filepath.Join(s.projectRoot, "templates", relPath)
	return filepath.WalkDir(absDir, func(path string, d os.DirEntry, err error) error {
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
func (s *TemplateSource) Stat(relPath string) (os.FileInfo, error) {
	return os.Stat(filepath.Join(s.projectRoot, "templates", relPath))
}

// Exists returns true if the path exists.
func (s *TemplateSource) Exists(relPath string) bool {
	_, err := s.Stat(relPath)
	return err == nil
}
