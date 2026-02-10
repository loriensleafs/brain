package main

import (
	"flag"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"regexp"
	"strings"
)

// FixFencesOutput represents the output for fix-fences command
type FixFencesOutput struct {
	Success      bool     `json:"success"`
	FixedFiles   []string `json:"fixedFiles"`
	TotalFixed   int      `json:"totalFixed"`
	TotalScanned int      `json:"totalScanned"`
	DryRun       bool     `json:"dryRun"`
	Error        string   `json:"error,omitempty"`
}

var (
	openingPattern = regexp.MustCompile("^(\\s*)```(\\w+)")
	closingPattern = regexp.MustCompile("^(\\s*)```\\s*$")
)

func runFixFences() error {
	// Use FlagSet for subcommand to avoid conflicts with global flags
	fs := flag.NewFlagSet("fix-fences", flag.ContinueOnError)
	pattern := fs.String("pattern", "**/*.md", "Glob pattern for markdown files")
	dryRun := fs.Bool("dry-run", false, "Report changes without writing files")
	help := fs.Bool("help", false, "Show usage information")

	// Parse args after the subcommand name
	if err := fs.Parse(os.Args[2:]); err != nil {
		return err
	}

	if *help {
		fmt.Fprintln(os.Stderr, "fix-fences - Fix malformed markdown code fence closings")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Usage:")
		fmt.Fprintln(os.Stderr, "  brain-skills fix-fences [flags] [directories...]")
		fmt.Fprintln(os.Stderr, "")
		fmt.Fprintln(os.Stderr, "Flags:")
		fmt.Fprintln(os.Stderr, "  --pattern string   Glob pattern for markdown files (default \"**/*.md\")")
		fmt.Fprintln(os.Stderr, "  --dry-run          Report changes without writing files")
		fmt.Fprintln(os.Stderr, "  --help             Show this help message")
		return nil
	}

	directories := fs.Args()
	if len(directories) == 0 {
		directories = []string{"."}
	}

	output := FixFencesOutput{
		Success:    true,
		FixedFiles: []string{},
		DryRun:     *dryRun,
	}

	for _, dir := range directories {
		info, err := os.Stat(dir)
		if err != nil {
			if os.IsNotExist(err) {
				fmt.Fprintf(os.Stderr, "Warning: directory does not exist: %s\n", dir)
				continue
			}
			output.Success = false
			output.Error = fmt.Sprintf("failed to access directory %s: %v", dir, err)
			return outputJSON(output)
		}
		if !info.IsDir() {
			fmt.Fprintf(os.Stderr, "Warning: not a directory: %s\n", dir)
			continue
		}

		absDir, err := filepath.Abs(dir)
		if err != nil {
			output.Success = false
			output.Error = fmt.Sprintf("failed to resolve path %s: %v", dir, err)
			return outputJSON(output)
		}

		fixed, scanned, err := fixMarkdownFiles(absDir, *pattern, *dryRun)
		if err != nil {
			output.Success = false
			output.Error = fmt.Sprintf("failed to process directory %s: %v", dir, err)
			return outputJSON(output)
		}

		output.FixedFiles = append(output.FixedFiles, fixed...)
		output.TotalScanned += scanned
	}

	output.TotalFixed = len(output.FixedFiles)
	return outputJSON(output)
}

func fixMarkdownFences(content string) string {
	lines := strings.Split(content, "\n")
	result := make([]string, 0, len(lines))
	inCodeBlock := false
	blockIndent := ""

	for _, line := range lines {
		openingMatch := openingPattern.FindStringSubmatch(line)
		closingMatch := closingPattern.FindStringSubmatch(line)

		if openingMatch != nil {
			if inCodeBlock {
				result = append(result, blockIndent+"```")
			}
			result = append(result, line)
			blockIndent = openingMatch[1]
			inCodeBlock = true
		} else if closingMatch != nil {
			result = append(result, line)
			inCodeBlock = false
			blockIndent = ""
		} else {
			result = append(result, line)
		}
	}

	if inCodeBlock {
		result = append(result, blockIndent+"```")
	}

	return strings.Join(result, "\n")
}

func fixMarkdownFiles(directory, pattern string, dryRun bool) ([]string, int, error) {
	var fixed []string
	scanned := 0

	err := filepath.WalkDir(directory, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}

		if d.IsDir() {
			return nil
		}

		matched, err := matchPattern(path, directory, pattern)
		if err != nil {
			return err
		}
		if !matched {
			return nil
		}

		scanned++

		content, err := os.ReadFile(path)
		if err != nil {
			return fmt.Errorf("failed to read %s: %w", path, err)
		}

		fixedContent := fixMarkdownFences(string(content))

		if string(content) != fixedContent {
			if !dryRun {
				if err := os.WriteFile(path, []byte(fixedContent), 0644); err != nil {
					return fmt.Errorf("failed to write %s: %w", path, err)
				}
			}
			fixed = append(fixed, path)
		}

		return nil
	})

	if err != nil {
		return nil, 0, err
	}

	return fixed, scanned, nil
}

func matchPattern(path, baseDir, pattern string) (bool, error) {
	relPath, err := filepath.Rel(baseDir, path)
	if err != nil {
		return false, err
	}

	if strings.Contains(pattern, "**") {
		parts := strings.Split(pattern, "**")
		if len(parts) == 2 {
			suffix := strings.TrimPrefix(parts[1], "/")
			suffix = strings.TrimPrefix(suffix, string(filepath.Separator))
			if suffix == "" {
				return true, nil
			}
			matched, err := filepath.Match(suffix, filepath.Base(path))
			if err != nil {
				return false, err
			}
			return matched, nil
		}
	}

	matched, err := filepath.Match(pattern, relPath)
	if err != nil {
		return false, err
	}
	if matched {
		return true, nil
	}

	matched, err = filepath.Match(pattern, filepath.Base(path))
	if err != nil {
		return false, err
	}
	return matched, nil
}
