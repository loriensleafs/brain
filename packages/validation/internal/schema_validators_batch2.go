// Package internal provides schema-based validation for batch 2 validators.
// This file contains schema loading and validation for:
// - test-coverage-gaps
// - check-skill-exists
// - check-tasks
// - batch-pr-review
// - pr-maintenance
package internal

import (
	"encoding/json"
	"fmt"
	"sync"

	"github.com/santhosh-tekuri/jsonschema/v6"
)

// Schema data variables set by the parent package via embed
var (
	testCoverageGapsSchemaData  []byte
	checkSkillExistsSchemaData  []byte
	checkTasksSchemaData        []byte
	batchPRReviewSchemaData     []byte
	prMaintenanceSchemaData     []byte
)

// Schema compilation singletons
var (
	testCoverageGapsSchemaOnce     sync.Once
	testCoverageGapsSchemaCompiled *jsonschema.Schema
	testCoverageGapsSchemaErr      error

	checkSkillExistsSchemaOnce     sync.Once
	checkSkillExistsSchemaCompiled *jsonschema.Schema
	checkSkillExistsSchemaErr      error

	checkTasksSchemaOnce     sync.Once
	checkTasksSchemaCompiled *jsonschema.Schema
	checkTasksSchemaErr      error

	batchPRReviewSchemaOnce     sync.Once
	batchPRReviewSchemaCompiled *jsonschema.Schema
	batchPRReviewSchemaErr      error

	prMaintenanceSchemaOnce     sync.Once
	prMaintenanceSchemaCompiled *jsonschema.Schema
	prMaintenanceSchemaErr      error
)

// SetTestCoverageGapsSchemaData sets the schema data for test coverage gaps validation.
func SetTestCoverageGapsSchemaData(data []byte) {
	testCoverageGapsSchemaData = data
}

// SetCheckSkillExistsSchemaData sets the schema data for skill exists validation.
func SetCheckSkillExistsSchemaData(data []byte) {
	checkSkillExistsSchemaData = data
}

// SetCheckTasksSchemaData sets the schema data for tasks validation.
func SetCheckTasksSchemaData(data []byte) {
	checkTasksSchemaData = data
}

// SetBatchPRReviewSchemaData sets the schema data for batch PR review validation.
func SetBatchPRReviewSchemaData(data []byte) {
	batchPRReviewSchemaData = data
}

// SetPRMaintenanceSchemaData sets the schema data for PR maintenance validation.
func SetPRMaintenanceSchemaData(data []byte) {
	prMaintenanceSchemaData = data
}

// getTestCoverageGapsSchema returns the compiled test coverage gaps schema.
func getTestCoverageGapsSchema() (*jsonschema.Schema, error) {
	testCoverageGapsSchemaOnce.Do(func() {
		if testCoverageGapsSchemaData == nil {
			testCoverageGapsSchemaErr = fmt.Errorf("test coverage gaps schema data not set; call SetTestCoverageGapsSchemaData first")
			return
		}
		testCoverageGapsSchemaCompiled, testCoverageGapsSchemaErr = compileSchema("test-coverage-gaps.schema.json", testCoverageGapsSchemaData)
	})
	return testCoverageGapsSchemaCompiled, testCoverageGapsSchemaErr
}

// getCheckSkillExistsSchema returns the compiled check skill exists schema.
func getCheckSkillExistsSchema() (*jsonschema.Schema, error) {
	checkSkillExistsSchemaOnce.Do(func() {
		if checkSkillExistsSchemaData == nil {
			checkSkillExistsSchemaErr = fmt.Errorf("check skill exists schema data not set; call SetCheckSkillExistsSchemaData first")
			return
		}
		checkSkillExistsSchemaCompiled, checkSkillExistsSchemaErr = compileSchema("check-skill-exists.schema.json", checkSkillExistsSchemaData)
	})
	return checkSkillExistsSchemaCompiled, checkSkillExistsSchemaErr
}

// getCheckTasksSchema returns the compiled check tasks schema.
func getCheckTasksSchema() (*jsonschema.Schema, error) {
	checkTasksSchemaOnce.Do(func() {
		if checkTasksSchemaData == nil {
			checkTasksSchemaErr = fmt.Errorf("check tasks schema data not set; call SetCheckTasksSchemaData first")
			return
		}
		checkTasksSchemaCompiled, checkTasksSchemaErr = compileSchema("check-tasks.schema.json", checkTasksSchemaData)
	})
	return checkTasksSchemaCompiled, checkTasksSchemaErr
}

// getBatchPRReviewSchema returns the compiled batch PR review schema.
func getBatchPRReviewSchema() (*jsonschema.Schema, error) {
	batchPRReviewSchemaOnce.Do(func() {
		if batchPRReviewSchemaData == nil {
			batchPRReviewSchemaErr = fmt.Errorf("batch PR review schema data not set; call SetBatchPRReviewSchemaData first")
			return
		}
		batchPRReviewSchemaCompiled, batchPRReviewSchemaErr = compileSchema("batch-pr-review.schema.json", batchPRReviewSchemaData)
	})
	return batchPRReviewSchemaCompiled, batchPRReviewSchemaErr
}

// getPRMaintenanceSchema returns the compiled PR maintenance schema.
func getPRMaintenanceSchema() (*jsonschema.Schema, error) {
	prMaintenanceSchemaOnce.Do(func() {
		if prMaintenanceSchemaData == nil {
			prMaintenanceSchemaErr = fmt.Errorf("PR maintenance schema data not set; call SetPRMaintenanceSchemaData first")
			return
		}
		prMaintenanceSchemaCompiled, prMaintenanceSchemaErr = compileSchema("pr-maintenance.schema.json", prMaintenanceSchemaData)
	})
	return prMaintenanceSchemaCompiled, prMaintenanceSchemaErr
}

// compileSchema is a helper that compiles a JSON schema from bytes.
func compileSchema(name string, data []byte) (*jsonschema.Schema, error) {
	var schemaDoc any
	if err := json.Unmarshal(data, &schemaDoc); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", name, err)
	}

	c := jsonschema.NewCompiler()
	if err := c.AddResource(name, schemaDoc); err != nil {
		return nil, fmt.Errorf("failed to add %s resource: %w", name, err)
	}

	return c.Compile(name)
}

// ValidateTestCoverageGapsOptions validates options against the test coverage gaps schema.
func ValidateTestCoverageGapsOptions(opts TestCoverageGapOptions) []ValidationError {
	schema, err := getTestCoverageGapsSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Build options map manually with correct JSON keys
	optsMap := map[string]any{
		"basePath":   opts.BasePath,
		"stagedOnly": opts.StagedOnly,
		"threshold":  opts.Threshold,
	}
	// Only add optional fields if non-empty
	if opts.Language != "" {
		optsMap["language"] = opts.Language
	}
	if opts.IgnoreFile != "" {
		optsMap["ignoreFile"] = opts.IgnoreFile
	}
	if len(opts.CustomPatterns) > 0 {
		// Convert to []any for JSON schema validation
		patterns := make([]any, len(opts.CustomPatterns))
		for i, p := range opts.CustomPatterns {
			patterns[i] = p
		}
		optsMap["customPatterns"] = patterns
	}

	data := map[string]any{
		"options": optsMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidateTestCoverageGapsResult validates result against the test coverage gaps schema.
func ValidateTestCoverageGapsResult(result TestCoverageGapResult) []ValidationError {
	schema, err := getTestCoverageGapsSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert result to JSON then back to map for validation
	resultBytes, _ := json.Marshal(result)
	var resultMap map[string]any
	json.Unmarshal(resultBytes, &resultMap)

	data := map[string]any{
		"result": resultMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidateSkillExistsInput validates input against the check skill exists schema.
func ValidateSkillExistsInput(basePath, skillName string) []ValidationError {
	schema, err := getCheckSkillExistsSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	data := map[string]any{
		"skillInput": map[string]any{
			"basePath":  basePath,
			"skillName": skillName,
		},
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidateSkillExistsResult validates result against the check skill exists schema.
func ValidateSkillExistsResult(result SkillExistsResult) []ValidationError {
	schema, err := getCheckSkillExistsSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert result to JSON then back to map for validation
	resultBytes, _ := json.Marshal(result)
	var resultMap map[string]any
	json.Unmarshal(resultBytes, &resultMap)

	data := map[string]any{
		"skillResult": resultMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidateTasksInput validates task input against the check tasks schema.
func ValidateTasksInput(tasks []map[string]interface{}) []ValidationError {
	schema, err := getCheckTasksSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert to JSON then back to ensure proper types
	tasksBytes, _ := json.Marshal(tasks)
	var tasksSlice []any
	json.Unmarshal(tasksBytes, &tasksSlice)

	data := map[string]any{
		"input": map[string]any{
			"tasks": tasksSlice,
		},
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidateBatchPRReviewConfig validates config against the batch PR review schema.
func ValidateBatchPRReviewConfig(config BatchPRReviewConfig) []ValidationError {
	schema, err := getBatchPRReviewSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert PRNumbers to []any for JSON schema validation
	prNumbers := make([]any, len(config.PRNumbers))
	for i, n := range config.PRNumbers {
		prNumbers[i] = n
	}

	// Build config map manually with correct JSON keys
	configMap := map[string]any{
		"prNumbers":    prNumbers,
		"operation":    string(config.Operation),
		"worktreeRoot": config.WorktreeRoot,
		"force":        config.Force,
	}

	data := map[string]any{
		"config": configMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidateBatchPRReviewResult validates result against the batch PR review schema.
func ValidateBatchPRReviewResult(result BatchPRReviewResult) []ValidationError {
	schema, err := getBatchPRReviewSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert result to JSON then back to map for validation
	resultBytes, _ := json.Marshal(result)
	var resultMap map[string]any
	json.Unmarshal(resultBytes, &resultMap)

	data := map[string]any{
		"result": resultMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidatePRMaintenanceConfigInput validates config against the PR maintenance schema.
func ValidatePRMaintenanceConfigInput(config PRMaintenanceConfig) []ValidationError {
	schema, err := getPRMaintenanceSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert to map for validation
	configBytes, _ := json.Marshal(config)
	var configMap map[string]any
	json.Unmarshal(configBytes, &configMap)

	data := map[string]any{
		"config": configMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidatePRMaintenanceResult validates result against the PR maintenance schema.
func ValidatePRMaintenanceResult(result PRMaintenanceResult) []ValidationError {
	schema, err := getPRMaintenanceSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert result to JSON then back to map for validation
	resultBytes, _ := json.Marshal(result)
	var resultMap map[string]any
	json.Unmarshal(resultBytes, &resultMap)

	data := map[string]any{
		"result": resultMap,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}

// ValidatePullRequestInput validates PR data against the PR maintenance schema.
func ValidatePullRequestInput(prs []PullRequest) []ValidationError {
	schema, err := getPRMaintenanceSchema()
	if err != nil {
		return []ValidationError{{
			Field:      "",
			Constraint: "schema",
			Message:    err.Error(),
		}}
	}

	// Convert to JSON then back to slice of maps for validation
	prsBytes, _ := json.Marshal(prs)
	var prsSlice []any
	json.Unmarshal(prsBytes, &prsSlice)

	data := map[string]any{
		"pullRequests": prsSlice,
	}

	if err := schema.Validate(data); err != nil {
		return ExtractValidationErrors(err)
	}
	return nil
}
