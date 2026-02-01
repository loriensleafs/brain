package internal

import (
	"encoding/json"
	"fmt"
	"math"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// MemoryIndexValidationResult represents the outcome of memory index validation.
type MemoryIndexValidationResult struct {
	ValidationResult
	MemoryPath        string                       `json:"memoryPath,omitempty"`
	Timestamp         string                       `json:"timestamp,omitempty"`
	DomainResults     map[string]DomainIndexResult `json:"domainResults,omitempty"`
	MemoryIndexResult MemoryIndexReferenceResult   `json:"memoryIndexResult,omitempty"`
	Orphans           []OrphanedFile               `json:"orphans,omitempty"`
	Summary           MemoryIndexSummary           `json:"summary"`
}

// DomainIndexResult represents validation results for a single domain index.
type DomainIndexResult struct {
	IndexPath          string               `json:"indexPath"`
	Entries            int                  `json:"entries"`
	FileReferences     FileReferenceResult  `json:"fileReferences"`
	KeywordDensity     KeywordDensityResult `json:"keywordDensity"`
	IndexFormat        IndexFormatResult    `json:"indexFormat"`
	DuplicateEntries   DuplicateResult      `json:"duplicateEntries"`
	MinimumKeywords    MinKeywordResult     `json:"minimumKeywords"`
	DomainPrefixNaming PrefixNamingResult   `json:"domainPrefixNaming"`
	Passed             bool                 `json:"passed"`
}

// FileReferenceResult represents validation of file references.
type FileReferenceResult struct {
	Passed           bool     `json:"passed"`
	Issues           []string `json:"issues,omitempty"`
	MissingFiles     []string `json:"missingFiles,omitempty"`
	ValidFiles       []string `json:"validFiles,omitempty"`
	NamingViolations []string `json:"namingViolations,omitempty"`
}

// KeywordDensityResult represents keyword uniqueness validation.
type KeywordDensityResult struct {
	Passed    bool               `json:"passed"`
	Issues    []string           `json:"issues,omitempty"`
	Densities map[string]float64 `json:"densities,omitempty"`
}

// IndexFormatResult represents index format validation (pure lookup table).
type IndexFormatResult struct {
	Passed         bool     `json:"passed"`
	Issues         []string `json:"issues,omitempty"`
	ViolationLines []int    `json:"violationLines,omitempty"`
}

// DuplicateResult represents duplicate entry detection.
type DuplicateResult struct {
	Passed     bool     `json:"passed"`
	Issues     []string `json:"issues,omitempty"`
	Duplicates []string `json:"duplicates,omitempty"`
}

// MinKeywordResult represents minimum keyword count validation.
type MinKeywordResult struct {
	Passed        bool           `json:"passed"`
	Issues        []string       `json:"issues,omitempty"`
	KeywordCounts map[string]int `json:"keywordCounts,omitempty"`
}

// PrefixNamingResult represents domain prefix naming validation.
type PrefixNamingResult struct {
	Passed        bool     `json:"passed"`
	Issues        []string `json:"issues,omitempty"`
	NonConforming []string `json:"nonConforming,omitempty"`
}

// MemoryIndexReferenceResult represents validation of memory-index.md references.
type MemoryIndexReferenceResult struct {
	Passed              bool     `json:"passed"`
	Issues              []string `json:"issues,omitempty"`
	UnreferencedIndices []string `json:"unreferencedIndices,omitempty"`
	BrokenReferences    []string `json:"brokenReferences,omitempty"`
}

// OrphanedFile represents a file not referenced by any index.
type OrphanedFile struct {
	File          string `json:"file"`
	Domain        string `json:"domain"`
	ExpectedIndex string `json:"expectedIndex"`
}

// MemoryIndexSummary provides aggregate statistics.
type MemoryIndexSummary struct {
	TotalDomains  int `json:"totalDomains"`
	PassedDomains int `json:"passedDomains"`
	FailedDomains int `json:"failedDomains"`
	TotalFiles    int `json:"totalFiles"`
	MissingFiles  int `json:"missingFiles"`
	KeywordIssues int `json:"keywordIssues"`
}

// IndexEntry represents a parsed entry from a domain index.
type IndexEntry struct {
	Keywords    []string `json:"keywords"`
	FileName    string   `json:"fileName"`
	RawKeywords string   `json:"rawKeywords,omitempty"`
}

var (
	memoryIndexEntrySchemaOnce     sync.Once
	memoryIndexEntrySchemaCompiled *jsonschema.Schema
	memoryIndexEntrySchemaErr      error
	memoryIndexEntrySchemaData     []byte
)

// SetMemoryIndexEntrySchemaData sets the schema data for memory index entry validation.
func SetMemoryIndexEntrySchemaData(data []byte) {
	memoryIndexEntrySchemaData = data
}

// getMemoryIndexEntrySchema returns the compiled memory index entry schema.
func getMemoryIndexEntrySchema() (*jsonschema.Schema, error) {
	memoryIndexEntrySchemaOnce.Do(func() {
		if memoryIndexEntrySchemaData == nil {
			memoryIndexEntrySchemaErr = fmt.Errorf("memory index entry schema data not set; call SetMemoryIndexEntrySchemaData first")
			return
		}

		var schemaDoc any
		if err := json.Unmarshal(memoryIndexEntrySchemaData, &schemaDoc); err != nil {
			memoryIndexEntrySchemaErr = fmt.Errorf("failed to parse memory index entry schema: %w", err)
			return
		}

		c := jsonschema.NewCompiler()
		if err := c.AddResource("memory-index-entry.schema.json", schemaDoc); err != nil {
			memoryIndexEntrySchemaErr = fmt.Errorf("failed to add memory index entry schema resource: %w", err)
			return
		}

		memoryIndexEntrySchemaCompiled, memoryIndexEntrySchemaErr = c.Compile("memory-index-entry.schema.json")
	})
	return memoryIndexEntrySchemaCompiled, memoryIndexEntrySchemaErr
}

// ValidateIndexEntry validates an IndexEntry against the JSON Schema.
func ValidateIndexEntry(entry IndexEntry) bool {
	schema, err := getMemoryIndexEntrySchema()
	if err != nil {
		return false
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return false
	}

	var entryMap any
	if err := json.Unmarshal(data, &entryMap); err != nil {
		return false
	}

	return schema.Validate(entryMap) == nil
}

// GetIndexEntryErrors returns validation errors for an IndexEntry.
func GetIndexEntryErrors(entry IndexEntry) []ValidationError {
	schema, err := getMemoryIndexEntrySchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	data, err := json.Marshal(entry)
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "marshal",
			Message:    err.Error(),
		}}
	}

	var entryMap any
	if err := json.Unmarshal(data, &entryMap); err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "unmarshal",
			Message:    err.Error(),
		}}
	}

	err = schema.Validate(entryMap)
	if err == nil {
		return []ValidationError{}
	}

	return ExtractValidationErrors(err)
}

// DomainIndex represents a domain index file.
type DomainIndex struct {
	Path   string
	Name   string
	Domain string
}

// ValidateMemoryIndex validates the memory index structure and references.
// memoryPath is the base path to the memories directory.
// Returns a comprehensive validation result.
func ValidateMemoryIndex(memoryPath string) MemoryIndexValidationResult {
	result := MemoryIndexValidationResult{
		MemoryPath:    memoryPath,
		Timestamp:     time.Now().Format(time.RFC3339),
		DomainResults: make(map[string]DomainIndexResult),
		Summary:       MemoryIndexSummary{},
	}

	var checks []Check
	allPassed := true

	// Resolve path
	resolvedPath := memoryPath
	if !filepath.IsAbs(memoryPath) {
		if cwd, err := os.Getwd(); err == nil {
			resolvedPath = filepath.Join(cwd, memoryPath)
		}
	}

	// Check if memory path exists
	if !DirExists(resolvedPath) {
		result.ValidationResult = ValidationResult{
			Valid:   false,
			Message: "Memory path not found: " + resolvedPath,
			Checks: []Check{{
				Name:    "memory_path_exists",
				Passed:  false,
				Message: "Memory path not found: " + resolvedPath,
			}},
		}
		return result
	}

	// Find all domain indices
	domainIndices := getDomainIndices(resolvedPath)
	result.Summary.TotalDomains = len(domainIndices)

	// Validate each domain index
	for _, index := range domainIndices {
		domainResult := validateDomainIndex(index, resolvedPath)
		result.DomainResults[index.Domain] = domainResult
		result.Summary.TotalFiles += domainResult.Entries

		if domainResult.Passed {
			result.Summary.PassedDomains++
			checks = append(checks, Check{
				Name:    "domain_" + index.Domain,
				Passed:  true,
				Message: "Domain index " + index.Domain + " validation passed",
			})
		} else {
			result.Summary.FailedDomains++
			allPassed = false
			checks = append(checks, Check{
				Name:    "domain_" + index.Domain,
				Passed:  false,
				Message: "Domain index " + index.Domain + " validation failed",
			})
		}

		// Aggregate counts
		result.Summary.MissingFiles += len(domainResult.FileReferences.MissingFiles)
		result.Summary.KeywordIssues += len(domainResult.KeywordDensity.Issues)
	}

	// Validate memory-index references
	memIndexResult := validateMemoryIndexReferences(resolvedPath, domainIndices)
	result.MemoryIndexResult = memIndexResult

	if !memIndexResult.Passed {
		allPassed = false
		checks = append(checks, Check{
			Name:    "memory_index_references",
			Passed:  false,
			Message: "Memory index reference validation failed",
		})
	} else {
		checks = append(checks, Check{
			Name:    "memory_index_references",
			Passed:  true,
			Message: "Memory index reference validation passed",
		})
	}

	// Find orphaned files
	orphans := getOrphanedFiles(domainIndices, resolvedPath)
	result.Orphans = orphans

	if len(orphans) > 0 {
		// Orphans are warnings (P1), not blocking
		checks = append(checks, Check{
			Name:    "orphaned_files",
			Passed:  true, // Warning only
			Message: Itoa(len(orphans)) + " orphaned files detected (warning)",
		})
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Memory index validation passed"
	} else {
		result.Message = "Memory index validation failed"
		result.Remediation = buildMemoryIndexRemediation(result)
	}

	return result
}

// ValidateMemoryIndexFromContent validates memory index from content strings.
// Useful for testing without file system.
func ValidateMemoryIndexFromContent(indexContents map[string]string, memoryIndexContent string) MemoryIndexValidationResult {
	result := MemoryIndexValidationResult{
		Timestamp:     time.Now().Format(time.RFC3339),
		DomainResults: make(map[string]DomainIndexResult),
		Summary:       MemoryIndexSummary{},
	}

	var checks []Check
	allPassed := true

	// Parse domain indices from content
	for domain, content := range indexContents {
		entries := parseIndexEntries(content)
		domainResult := DomainIndexResult{
			Entries: len(entries),
			Passed:  true,
		}

		// Validate index format
		formatResult := validateIndexFormatFromContent(content)
		domainResult.IndexFormat = formatResult
		if !formatResult.Passed {
			domainResult.Passed = false
		}

		// Validate duplicate entries
		dupResult := validateDuplicateEntries(entries)
		domainResult.DuplicateEntries = dupResult
		if !dupResult.Passed {
			domainResult.Passed = false
		}

		// Validate keyword density
		densityResult := validateKeywordDensity(entries)
		domainResult.KeywordDensity = densityResult
		if !densityResult.Passed {
			domainResult.Passed = false
		}

		// Validate minimum keywords (P2 warning)
		minKeywordResult := validateMinimumKeywords(entries, 5)
		domainResult.MinimumKeywords = minKeywordResult

		// Validate domain prefix naming (P2 warning)
		prefixResult := validateDomainPrefixNaming(entries, domain)
		domainResult.DomainPrefixNaming = prefixResult

		result.DomainResults[domain] = domainResult
		result.Summary.TotalDomains++
		result.Summary.TotalFiles += len(entries)

		if domainResult.Passed {
			result.Summary.PassedDomains++
			checks = append(checks, Check{
				Name:    "domain_" + domain,
				Passed:  true,
				Message: "Domain index " + domain + " validation passed",
			})
		} else {
			result.Summary.FailedDomains++
			allPassed = false
			checks = append(checks, Check{
				Name:    "domain_" + domain,
				Passed:  false,
				Message: "Domain index " + domain + " validation failed",
			})
		}

		result.Summary.KeywordIssues += len(densityResult.Issues)
	}

	result.ValidationResult = ValidationResult{
		Valid:  allPassed,
		Checks: checks,
	}

	if allPassed {
		result.Message = "Memory index validation passed"
	} else {
		result.Message = "Memory index validation failed"
	}

	return result
}

// getDomainIndices finds all domain index files (skills-*-index.md pattern).
func getDomainIndices(memoryPath string) []DomainIndex {
	var indices []DomainIndex

	pattern := filepath.Join(memoryPath, "skills-*-index.md")
	matches, err := filepath.Glob(pattern)
	if err != nil || len(matches) == 0 {
		return indices
	}

	domainPattern := regexp.MustCompile(`^skills-(.+)-index$`)

	for _, path := range matches {
		baseName := strings.TrimSuffix(filepath.Base(path), ".md")
		match := domainPattern.FindStringSubmatch(baseName)
		if len(match) > 1 {
			indices = append(indices, DomainIndex{
				Path:   path,
				Name:   baseName,
				Domain: match[1],
			})
		}
	}

	return indices
}

// parseIndexEntries parses a domain index file and extracts keyword-file mappings.
func parseIndexEntries(content string) []IndexEntry {
	var entries []IndexEntry

	lines := strings.Split(content, "\n")
	tableRowPattern := regexp.MustCompile(`^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$`)

	for _, line := range lines {
		match := tableRowPattern.FindStringSubmatch(line)
		if len(match) < 3 {
			continue
		}

		keywords := strings.TrimSpace(match[1])
		fileName := strings.TrimSpace(match[2])

		// Skip header row
		if keywords == "Keywords" || strings.HasPrefix(keywords, "-") {
			continue
		}

		// Skip separator row
		if strings.HasPrefix(fileName, "-") {
			continue
		}

		keywordList := strings.Fields(keywords)

		entries = append(entries, IndexEntry{
			Keywords:    keywordList,
			FileName:    fileName,
			RawKeywords: keywords,
		})
	}

	return entries
}

// getIndexEntries reads and parses entries from an index file.
func getIndexEntries(indexPath string) []IndexEntry {
	content, err := os.ReadFile(indexPath)
	if err != nil {
		return nil
	}
	return parseIndexEntries(string(content))
}

// validateDomainIndex validates a single domain index.
func validateDomainIndex(index DomainIndex, memoryPath string) DomainIndexResult {
	entries := getIndexEntries(index.Path)

	result := DomainIndexResult{
		IndexPath: index.Path,
		Entries:   len(entries),
		Passed:    true,
	}

	// P0: Test file references
	fileResult := validateIndexFileReferences(entries, memoryPath)
	result.FileReferences = fileResult
	if !fileResult.Passed {
		result.Passed = false
	}

	// P0: Test keyword density
	densityResult := validateKeywordDensity(entries)
	result.KeywordDensity = densityResult
	if !densityResult.Passed {
		result.Passed = false
	}

	// P0: Test index format
	formatResult := validateIndexFormat(index.Path)
	result.IndexFormat = formatResult
	if !formatResult.Passed {
		result.Passed = false
	}

	// P0: Test duplicate entries
	dupResult := validateDuplicateEntries(entries)
	result.DuplicateEntries = dupResult
	if !dupResult.Passed {
		result.Passed = false
	}

	// P2: Test minimum keywords (warning only)
	minKeywordResult := validateMinimumKeywords(entries, 5)
	result.MinimumKeywords = minKeywordResult

	// P2: Test domain prefix naming (warning only)
	prefixResult := validateDomainPrefixNaming(entries, index.Domain)
	result.DomainPrefixNaming = prefixResult

	return result
}

// validateIndexFileReferences validates that all index entries point to existing files.
func validateIndexFileReferences(entries []IndexEntry, memoryPath string) FileReferenceResult {
	result := FileReferenceResult{
		Passed: true,
	}

	for _, entry := range entries {
		filePath := filepath.Join(memoryPath, entry.FileName+".md")

		// Check for deprecated skill- prefix
		if strings.HasPrefix(entry.FileName, "skill-") {
			result.Passed = false
			result.NamingViolations = append(result.NamingViolations, entry.FileName)
			result.Issues = append(result.Issues, "Index references deprecated 'skill-' prefix: "+entry.FileName+".md (ADR-017 violation)")
		}

		if FileExists(filePath) {
			result.ValidFiles = append(result.ValidFiles, entry.FileName)
		} else {
			result.Passed = false
			result.MissingFiles = append(result.MissingFiles, entry.FileName)
			result.Issues = append(result.Issues, "Missing file: "+entry.FileName+".md")
		}
	}

	return result
}

// validateKeywordDensity validates that each skill has >=40% unique keywords.
func validateKeywordDensity(entries []IndexEntry) KeywordDensityResult {
	result := KeywordDensityResult{
		Passed:    true,
		Densities: make(map[string]float64),
	}

	if len(entries) < 2 {
		// With only 1 entry, 100% unique by definition
		if len(entries) == 1 {
			result.Densities[entries[0].FileName] = 1.0
		}
		return result
	}

	// Build keyword sets for each entry (case-insensitive)
	keywordSets := make(map[string]map[string]bool)
	for _, entry := range entries {
		kwSet := make(map[string]bool)
		for _, kw := range entry.Keywords {
			kwSet[strings.ToLower(kw)] = true
		}
		keywordSets[entry.FileName] = kwSet
	}

	// Calculate uniqueness for each entry
	for _, entry := range entries {
		myKeywords := keywordSets[entry.FileName]

		// Build union of all other entries' keywords
		otherKeywords := make(map[string]bool)
		for _, otherEntry := range entries {
			if otherEntry.FileName != entry.FileName {
				for kw := range keywordSets[otherEntry.FileName] {
					otherKeywords[kw] = true
				}
			}
		}

		// Count unique keywords
		uniqueCount := 0
		for kw := range myKeywords {
			if !otherKeywords[kw] {
				uniqueCount++
			}
		}

		var density float64
		if len(myKeywords) > 0 {
			density = math.Round(float64(uniqueCount)/float64(len(myKeywords))*100) / 100
		}

		result.Densities[entry.FileName] = density

		if density < 0.40 {
			result.Passed = false
			result.Issues = append(result.Issues,
				"Low keyword uniqueness: "+entry.FileName+" has "+Itoa(int(density*100))+"% unique keywords (need >=40%)")
		}
	}

	return result
}

// validateIndexFormat validates that index files are pure lookup tables.
func validateIndexFormat(indexPath string) IndexFormatResult {
	content, err := os.ReadFile(indexPath)
	if err != nil {
		return IndexFormatResult{Passed: true}
	}
	return validateIndexFormatFromContent(string(content))
}

// validateIndexFormatFromContent validates index format from content string.
func validateIndexFormatFromContent(content string) IndexFormatResult {
	result := IndexFormatResult{
		Passed: true,
	}

	lines := strings.Split(content, "\n")
	lineNumber := 0
	tableHeaderFound := false

	titlePattern := regexp.MustCompile(`^#+\s+`)
	metadataPattern := regexp.MustCompile(`^\*\*[^*]+\*\*:\s*`)
	navPattern := regexp.MustCompile(`^Parent:\s*|^>\s*\[.*\]`)
	tableRowPattern := regexp.MustCompile(`^\|.*\|$`)

	for _, line := range lines {
		lineNumber++
		trimmedLine := strings.TrimSpace(line)

		// Skip empty lines
		if trimmedLine == "" {
			continue
		}

		// Check for prohibited patterns

		// Titles: # ...
		if titlePattern.MatchString(trimmedLine) {
			result.Passed = false
			result.ViolationLines = append(result.ViolationLines, lineNumber)
			result.Issues = append(result.Issues,
				"Line "+Itoa(lineNumber)+": Title detected - '"+trimmedLine+"' (prohibited per ADR-017)")
			continue
		}

		// Metadata blocks: **Key**: Value
		if metadataPattern.MatchString(trimmedLine) {
			result.Passed = false
			result.ViolationLines = append(result.ViolationLines, lineNumber)
			result.Issues = append(result.Issues,
				"Line "+Itoa(lineNumber)+": Metadata block detected - '"+trimmedLine+"' (prohibited per ADR-017)")
			continue
		}

		// Navigation sections
		if navPattern.MatchString(trimmedLine) {
			result.Passed = false
			result.ViolationLines = append(result.ViolationLines, lineNumber)
			result.Issues = append(result.Issues,
				"Line "+Itoa(lineNumber)+": Navigation section detected - '"+trimmedLine+"' (prohibited per ADR-017)")
			continue
		}

		// Check for table structure
		if tableRowPattern.MatchString(trimmedLine) {
			tableHeaderFound = true
			continue
		}

		// If we're past the table header and see non-table content, it's a violation
		if tableHeaderFound {
			result.Passed = false
			result.ViolationLines = append(result.ViolationLines, lineNumber)
			result.Issues = append(result.Issues,
				"Line "+Itoa(lineNumber)+": Non-table content detected - '"+trimmedLine+"' (prohibited per ADR-017)")
		}
	}

	return result
}

// validateDuplicateEntries detects duplicate file references within an index.
func validateDuplicateEntries(entries []IndexEntry) DuplicateResult {
	result := DuplicateResult{
		Passed: true,
	}

	seen := make(map[string]bool)
	for _, entry := range entries {
		if seen[entry.FileName] {
			result.Passed = false
			// Only add to duplicates list once
			found := false
			for _, d := range result.Duplicates {
				if d == entry.FileName {
					found = true
					break
				}
			}
			if !found {
				result.Duplicates = append(result.Duplicates, entry.FileName)
				result.Issues = append(result.Issues,
					"Duplicate entry: "+entry.FileName+" appears multiple times in index")
			}
		}
		seen[entry.FileName] = true
	}

	return result
}

// validateMinimumKeywords validates minimum keyword count per skill (P2 warning).
func validateMinimumKeywords(entries []IndexEntry, minKeywords int) MinKeywordResult {
	result := MinKeywordResult{
		Passed:        true,
		KeywordCounts: make(map[string]int),
	}

	for _, entry := range entries {
		count := len(entry.Keywords)
		result.KeywordCounts[entry.FileName] = count

		if count < minKeywords {
			result.Passed = false
			result.Issues = append(result.Issues,
				"Insufficient keywords: "+entry.FileName+" has "+Itoa(count)+" keywords (need >="+Itoa(minKeywords)+")")
		}
	}

	return result
}

// validateDomainPrefixNaming validates {domain}-{description} naming convention (P2 warning).
func validateDomainPrefixNaming(entries []IndexEntry, domain string) PrefixNamingResult {
	result := PrefixNamingResult{
		Passed: true,
	}

	expectedPrefix := domain + "-"

	for _, entry := range entries {
		if !strings.HasPrefix(entry.FileName, expectedPrefix) {
			result.Passed = false
			result.NonConforming = append(result.NonConforming, entry.FileName)
			result.Issues = append(result.Issues,
				"Naming violation: "+entry.FileName+" should start with '"+expectedPrefix+"' per ADR-017")
		}
	}

	return result
}

// validateMemoryIndexReferences validates memory-index.md references.
func validateMemoryIndexReferences(memoryPath string, domainIndices []DomainIndex) MemoryIndexReferenceResult {
	result := MemoryIndexReferenceResult{
		Passed: true,
	}

	memoryIndexPath := filepath.Join(memoryPath, "memory-index.md")

	if !FileExists(memoryIndexPath) {
		result.Passed = false
		result.Issues = append(result.Issues, "CRITICAL: memory-index.md not found - required for tiered architecture")
		return result
	}

	content, err := os.ReadFile(memoryIndexPath)
	if err != nil {
		result.Passed = false
		result.Issues = append(result.Issues, "Could not read memory-index.md: "+err.Error())
		return result
	}

	contentStr := string(content)

	// P1: Check that ALL domain indices are referenced (completeness)
	for _, index := range domainIndices {
		if !strings.Contains(contentStr, index.Name) {
			result.Passed = false
			result.UnreferencedIndices = append(result.UnreferencedIndices, index.Name)
			result.Issues = append(result.Issues,
				"P1 COMPLETENESS: Domain index not referenced in memory-index: "+index.Name)
		}
	}

	// P1: Check that all references in memory-index point to existing files (validity)
	lines := strings.Split(contentStr, "\n")
	tableRowPattern := regexp.MustCompile(`^\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|$`)

	for _, line := range lines {
		match := tableRowPattern.FindStringSubmatch(line)
		if len(match) < 3 {
			continue
		}

		fileEntry := strings.TrimSpace(match[2])

		// Skip header/separator rows
		if fileEntry == "File" || strings.HasPrefix(fileEntry, "-") ||
			fileEntry == "Essential Memories" || fileEntry == "Memory" {
			continue
		}

		// Handle comma-separated file lists
		fileNames := strings.Split(fileEntry, ",")
		for _, fileName := range fileNames {
			fileName = strings.TrimSpace(fileName)
			if fileName == "" {
				continue
			}

			refPath := filepath.Join(memoryPath, fileName+".md")
			if !FileExists(refPath) {
				result.Passed = false
				result.BrokenReferences = append(result.BrokenReferences, fileName)
				result.Issues = append(result.Issues,
					"P1 VALIDITY: memory-index references non-existent file: "+fileName+".md")
			}
		}
	}

	return result
}

// getOrphanedFiles finds atomic skill files not referenced by any domain index.
func getOrphanedFiles(allIndices []DomainIndex, memoryPath string) []OrphanedFile {
	var orphans []OrphanedFile

	// Collect all referenced files from all indices
	referencedFiles := make(map[string]bool)
	for _, index := range allIndices {
		entries := getIndexEntries(index.Path)
		for _, entry := range entries {
			referencedFiles[entry.FileName] = true
		}
	}

	// Get all .md files in memory path
	allFiles, err := filepath.Glob(filepath.Join(memoryPath, "*.md"))
	if err != nil {
		return orphans
	}

	// Extract domains from indices
	domains := make([]string, 0, len(allIndices))
	for _, index := range allIndices {
		domains = append(domains, index.Domain)
	}

	skillPrefixPattern := regexp.MustCompile(`^skill-`)
	skillsInvalidPattern := regexp.MustCompile(`^skills-`)
	indexSuffixPattern := regexp.MustCompile(`-index$`)

	for _, filePath := range allFiles {
		baseName := strings.TrimSuffix(filepath.Base(filePath), ".md")

		// Skip index files
		if indexSuffixPattern.MatchString(baseName) {
			continue
		}

		// Skip known non-atomic files
		if baseName == "memory-index" {
			continue
		}

		// Check for deprecated skill- prefix
		if skillPrefixPattern.MatchString(baseName) && !referencedFiles[baseName] {
			orphans = append(orphans, OrphanedFile{
				File:          baseName,
				Domain:        "INVALID",
				ExpectedIndex: "Rename to {domain}-{description} format per ADR-017",
			})
			continue
		}

		// Check for improperly named skills-* files
		if skillsInvalidPattern.MatchString(baseName) && !indexSuffixPattern.MatchString(baseName) {
			orphans = append(orphans, OrphanedFile{
				File:          baseName,
				Domain:        "INVALID",
				ExpectedIndex: "Rename to {domain}-{description}-index format or move to atomic file per ADR-017",
			})
			continue
		}

		// Check if file follows atomic naming pattern (domain prefix)
		for _, domain := range domains {
			prefix := domain + "-"
			if strings.HasPrefix(baseName, prefix) && !referencedFiles[baseName] {
				orphans = append(orphans, OrphanedFile{
					File:          baseName,
					Domain:        domain,
					ExpectedIndex: "skills-" + domain + "-index",
				})
			}
		}
	}

	return orphans
}

// buildMemoryIndexRemediation constructs remediation guidance.
func buildMemoryIndexRemediation(result MemoryIndexValidationResult) string {
	var parts []string

	if result.Summary.FailedDomains > 0 {
		parts = append(parts, Itoa(result.Summary.FailedDomains)+" domain index(es) failed validation")
	}

	if result.Summary.MissingFiles > 0 {
		parts = append(parts, Itoa(result.Summary.MissingFiles)+" referenced file(s) not found")
	}

	if result.Summary.KeywordIssues > 0 {
		parts = append(parts, Itoa(result.Summary.KeywordIssues)+" keyword density issue(s)")
	}

	if !result.MemoryIndexResult.Passed {
		parts = append(parts, "memory-index.md reference issues")
	}

	if len(parts) == 0 {
		return ""
	}

	return "Fix the following: " + strings.Join(parts, ", ") + ". See ADR-017 for tiered memory architecture requirements."
}
