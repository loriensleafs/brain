package internal

import (
	"os"
	"strconv"
	"strings"
)

// DirExists checks if a directory exists at the given path.
func DirExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
}

// FileExists checks if a file exists at the given path.
func FileExists(path string) bool {
	info, err := os.Stat(path)
	return err == nil && !info.IsDir()
}

// Itoa converts an integer to a string.
func Itoa(i int) string {
	return strconv.Itoa(i)
}

// ParseFrontmatter extracts and parses YAML frontmatter from content.
// Returns the parsed frontmatter and any YAML syntax error message.
func ParseFrontmatter(content string) (SkillFrontmatter, string) {
	var fm SkillFrontmatter

	// Check if content starts with ---
	if !strings.HasPrefix(content, "---") {
		return fm, ""
	}

	// Find the closing ---
	lines := strings.Split(content, "\n")
	if len(lines) < 2 {
		return fm, "Frontmatter not closed"
	}

	endIdx := -1
	for i := 1; i < len(lines); i++ {
		if strings.TrimSpace(lines[i]) == "---" {
			endIdx = i
			break
		}
	}

	if endIdx == -1 {
		return fm, "Frontmatter not closed"
	}

	// Extract YAML content (excluding the --- delimiters)
	yamlLines := lines[1:endIdx]
	fm.RawYAML = strings.Join(yamlLines, "\n")

	// Simple YAML parsing for name and description fields
	// This is intentionally simple and does not handle all YAML features
	yamlErr := ""
	for _, line := range yamlLines {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Check for valid key: value format
		colonIdx := strings.Index(line, ":")
		if colonIdx == -1 {
			yamlErr = "Invalid YAML syntax: missing colon in line '" + truncateYAMLLine(line) + "'"
			continue
		}

		key := strings.TrimSpace(line[:colonIdx])
		value := strings.TrimSpace(line[colonIdx+1:])

		// Remove quotes from value if present
		value = trimQuotes(value)

		switch key {
		case "name":
			fm.Name = value
		case "description":
			fm.Description = value
		}
	}

	return fm, yamlErr
}

// truncateYAMLLine truncates a YAML line for error display.
func truncateYAMLLine(line string) string {
	if len(line) > 40 {
		return line[:40] + "..."
	}
	return line
}

// trimQuotes removes surrounding quotes from a string.
func trimQuotes(s string) string {
	if len(s) >= 2 {
		if (s[0] == '"' && s[len(s)-1] == '"') || (s[0] == '\'' && s[len(s)-1] == '\'') {
			return s[1 : len(s)-1]
		}
	}
	return s
}
