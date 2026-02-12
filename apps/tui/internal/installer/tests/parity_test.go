package installer_test

import (
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

var update = flag.Bool("update", false, "update golden files")

// --- Fixture / setup ---------------------------------------------------------

func fixtureSourceDir(t *testing.T) string {
	t.Helper()
	dir, err := filepath.Abs("testdata/fixture-source")
	if err != nil {
		t.Fatalf("resolve fixture-source: %v", err)
	}
	if _, err := os.Stat(dir); err != nil {
		t.Fatalf("fixture-source not found at %s: %v", dir, err)
	}
	return dir
}

type fileMap map[string]string

func engineFilesToMap(files []installer.GeneratedFile) fileMap {
	m := make(fileMap, len(files))
	for _, f := range files {
		m[filepath.ToSlash(f.RelativePath)] = f.Content
	}
	return m
}

// --- Comparison Helpers -------------------------------------------------------

func contentEqual(path, a, b string) bool {
	switch {
	case strings.HasSuffix(path, ".json"):
		return jsonEqual([]byte(a), []byte(b))
	case strings.HasSuffix(path, ".md") || strings.HasSuffix(path, ".mdc"):
		return mdEqual(a, b)
	default:
		return a == b
	}
}

func jsonEqual(a, b []byte) bool {
	var ja, jb any
	if err := json.Unmarshal(a, &ja); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &jb); err != nil {
		return false
	}
	na, _ := json.Marshal(ja)
	nb, _ := json.Marshal(jb)
	return string(na) == string(nb)
}

func mdEqual(a, b string) bool {
	aFM, aBody := splitFrontmatter(a)
	bFM, bBody := splitFrontmatter(b)
	if aBody != bBody {
		return false
	}
	aLines := sortedNonEmpty(strings.Split(aFM, "\n"))
	bLines := sortedNonEmpty(strings.Split(bFM, "\n"))
	if len(aLines) != len(bLines) {
		return false
	}
	for i := range aLines {
		if aLines[i] != bLines[i] {
			return false
		}
	}
	return true
}

func splitFrontmatter(s string) (string, string) {
	if !strings.HasPrefix(s, "---\n") {
		return "", s
	}
	rest := s[4:]
	idx := strings.Index(rest, "\n---\n")
	if idx < 0 {
		return "", s
	}
	return rest[:idx], rest[idx+4:]
}

func sortedNonEmpty(ss []string) []string {
	var r []string
	for _, s := range ss {
		if strings.TrimSpace(s) != "" {
			r = append(r, s)
		}
	}
	sort.Strings(r)
	return r
}

func slicesEqual(a, b []string) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func truncate(s string, max int) string {
	if len(s) > max {
		return s[:max] + "..."
	}
	return s
}

// --- Golden File Helpers -----------------------------------------------------

const goldenBaseDir = "testdata/parity-golden"

func collectRelPaths(t *testing.T, dir string) []string {
	t.Helper()
	var paths []string
	filepath.WalkDir(dir, func(path string, d os.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		paths = append(paths, filepath.ToSlash(rel))
		return nil
	})
	sort.Strings(paths)
	return paths
}

func writeFileMap(t *testing.T, dir string, files fileMap) {
	t.Helper()
	for rel, content := range files {
		abs := filepath.Join(dir, rel)
		os.MkdirAll(filepath.Dir(abs), 0755)
		if err := os.WriteFile(abs, []byte(content), 0644); err != nil {
			t.Fatal(err)
		}
	}
}

func compareGoldenDir(t *testing.T, goldenDir string, actual fileMap) {
	t.Helper()
	if *update {
		os.RemoveAll(goldenDir)
		writeFileMap(t, goldenDir, actual)
		t.Logf("updated golden files at %s", goldenDir)
		return
	}
	goldenPaths := collectRelPaths(t, goldenDir)
	if len(goldenPaths) == 0 {
		t.Fatalf("no golden files at %s; run with -update to generate", goldenDir)
	}
	var actualPaths []string
	for p := range actual {
		actualPaths = append(actualPaths, p)
	}
	sort.Strings(actualPaths)
	if !slicesEqual(goldenPaths, actualPaths) {
		t.Errorf("file list mismatch:\n  golden: %v\n  actual: %v", goldenPaths, actualPaths)
		return
	}
	for _, rel := range goldenPaths {
		golden, _ := os.ReadFile(filepath.Join(goldenDir, rel))
		ac := actual[rel]
		if !contentEqual(rel, string(golden), ac) {
			t.Errorf("golden mismatch for %s:\n  golden: %s\n  actual: %s",
				rel, truncate(string(golden), 300), truncate(ac, 300))
		}
	}
}

// --- Data loaders ------------------------------------------------------------

func engineOutput(t *testing.T, tool *installer.ToolConfig) *installer.BuildOutput {
	t.Helper()
	src := installer.NewFilesystemSource(fixtureSourceDir(t))
	bc, err := src.Config()
	if err != nil {
		t.Fatal(err)
	}
	out, err := installer.BuildAll(src, tool, bc)
	if err != nil {
		t.Fatal(err)
	}
	return out
}

// =============================================================================
// GOLDEN FILE TESTS: Engine output stable across runs
// Run with -update to regenerate golden files.
// =============================================================================

func TestGolden_ClaudeCode_EngineOutput(t *testing.T) {
	eng := engineOutput(t, claudeToolConfigFull())
	files := engineFilesToMap(eng.AllFiles())
	goldenDir, _ := filepath.Abs(filepath.Join(goldenBaseDir, "claude-code"))
	compareGoldenDir(t, goldenDir, files)
}

func TestGolden_Cursor_EngineOutput(t *testing.T) {
	eng := engineOutput(t, cursorToolConfigFull())
	files := engineFilesToMap(eng.AllFiles())
	goldenDir, _ := filepath.Abs(filepath.Join(goldenBaseDir, "cursor"))
	compareGoldenDir(t, goldenDir, files)
}

// =============================================================================
// SANITY: All 6 content types produce output for both tools
// =============================================================================

func TestEngine_ClaudeCode_AllContentTypesPresent(t *testing.T) {
	out := engineOutput(t, claudeToolConfigFull())
	for name, n := range map[string]int{
		"Agents": len(out.Agents), "Skills": len(out.Skills),
		"Commands": len(out.Commands), "Rules": len(out.Rules),
		"Hooks": len(out.Hooks), "MCP": len(out.MCP),
	} {
		if n == 0 {
			t.Errorf("Claude Code: %s produced 0 files", name)
		}
	}
}

func TestEngine_Cursor_AllContentTypesPresent(t *testing.T) {
	out := engineOutput(t, cursorToolConfigFull())
	for name, n := range map[string]int{
		"Agents": len(out.Agents), "Skills": len(out.Skills),
		"Commands": len(out.Commands), "Rules": len(out.Rules),
		"Hooks": len(out.Hooks), "MCP": len(out.MCP),
	} {
		if n == 0 {
			t.Errorf("Cursor: %s produced 0 files", name)
		}
	}
}
