// Package validation provides validation utilities for the Brain project.
// This file provides the public API, re-exporting internal implementations.
package validation

import (
	_ "embed"

	"github.com/peterkloss/brain/packages/validation/internal"
)

// Embed schema files at package root level
//
//go:embed schemas/tools/bootstrap-context.schema.json
var bootstrapSchemaData []byte

//go:embed schemas/tools/search.schema.json
var searchSchemaData []byte

//go:embed schemas/tools/projects/list-projects.schema.json
var listProjectsSchemaData []byte

//go:embed schemas/tools/projects/delete-project.schema.json
var deleteProjectSchemaData []byte

//go:embed schemas/tools/projects/active-project.schema.json
var activeProjectSchemaData []byte

//go:embed schemas/tools/list-features-by-priority.schema.json
var listFeaturesByPrioritySchemaData []byte

//go:embed schemas/config/brain-config.schema.json
var brainConfigSchemaData []byte

//go:embed schemas/domain/workflow.schema.json
var workflowSchemaData []byte

func init() {
	// Initialize internal package with schema data
	internal.SetBootstrapSchemaData(bootstrapSchemaData)
	internal.SetSearchSchemaData(searchSchemaData)
	internal.SetListProjectsSchemaData(listProjectsSchemaData)
	internal.SetDeleteProjectSchemaData(deleteProjectSchemaData)
	internal.SetActiveProjectSchemaData(activeProjectSchemaData)
	internal.SetListFeaturesByPrioritySchemaData(listFeaturesByPrioritySchemaData)
	internal.SetBrainConfigSchemaData(brainConfigSchemaData)
	internal.SetWorkflowSchemaData(workflowSchemaData)
}

// Re-export core types
type (
	ValidationResult                = internal.ValidationResult
	Check                           = internal.Check
	ValidationError                 = internal.ValidationError
	WorkflowState                   = internal.WorkflowState
	SessionState                    = internal.SessionState
	ModeHistoryEntry                = internal.ModeHistoryEntry
	OrchestratorWorkflow            = internal.OrchestratorWorkflow
	ScenarioResult                  = internal.ScenarioResult
	ChecklistValidation             = internal.ChecklistValidation
	ChecklistItem                   = internal.ChecklistItem
	PrePRValidationResult           = internal.PrePRValidationResult
	CrossCuttingConcernsResult      = internal.CrossCuttingConcernsResult
	FailSafeDesignResult            = internal.FailSafeDesignResult
	TestImplementationResult        = internal.TestImplementationResult
	CIEnvironmentResult             = internal.CIEnvironmentResult
	EnvironmentVariablesResult      = internal.EnvironmentVariablesResult
	SessionProtocolValidationResult = internal.SessionProtocolValidationResult
	SkillFormatValidationResult     = internal.SkillFormatValidationResult
	SkillFrontmatter                = internal.SkillFrontmatter
	SkillFieldValidation            = internal.SkillFieldValidation
)

// Re-export validator types
type (
	ConsistencyValidationResult   = internal.ConsistencyValidationResult
	FeatureArtifacts              = internal.FeatureArtifacts
	ScopeAlignmentResult          = internal.ScopeAlignmentResult
	RequirementCoverageResult     = internal.RequirementCoverageResult
	NamingConventionsResult       = internal.NamingConventionsResult
	CrossReferencesResult         = internal.CrossReferencesResult
	TaskCompletionResult          = internal.TaskCompletionResult
	MemoryIndexValidationResult   = internal.MemoryIndexValidationResult
	PRDescriptionValidationResult = internal.PRDescriptionValidationResult
	PRDescriptionConfig           = internal.PRDescriptionConfig
	TraceabilityValidationResult  = internal.TraceabilityValidationResult
	SlashCommandValidationResult  = internal.SlashCommandValidationResult
	PrePRConfig                   = internal.PrePRConfig
	QASkipResult                  = internal.QASkipResult
)

// Re-export detector types
type (
	SkillViolation         = internal.SkillViolation
	SkillViolationResult   = internal.SkillViolationResult
	TestCoverageGapResult  = internal.TestCoverageGapResult
	MissingTestFile        = internal.MissingTestFile
	LanguageConfig         = internal.LanguageConfig
	TestCoverageGapOptions = internal.TestCoverageGapOptions
)

// Re-export checker types
type (
	SkillExistsResult = internal.SkillExistsResult
)

// Re-export invoker types
type (
	BatchPRReviewConfig     = internal.BatchPRReviewConfig
	BatchPRReviewResult     = internal.BatchPRReviewResult
	WorktreeStatus          = internal.WorktreeStatus
	WorktreeOperationResult = internal.WorktreeOperationResult
	PRMaintenanceConfig     = internal.PRMaintenanceConfig
	PRMaintenanceResult     = internal.PRMaintenanceResult
	PRMaintenanceOutput     = internal.PRMaintenanceOutput
	PullRequest             = internal.PullRequest
	PRActionItem            = internal.PRActionItem
	CommandRunner           = internal.CommandRunner
	RealCommandRunner       = internal.RealCommandRunner
	ReviewRequest           = internal.ReviewRequest
	StatusCheckContext      = internal.StatusCheckContext
	StatusCheckRollup       = internal.StatusCheckRollup
	PRCommit                = internal.PRCommit
	CheckState              = internal.CheckState
	CheckConclusion         = internal.CheckConclusion
)

// Re-export schema validation types (from internal/validate_bootstrap.go, validate_search.go, validate_projects.go, validate_list_features_by_priority.go, validate_brain_config.go)
type (
	BootstrapContextArgs       = internal.BootstrapContextArgs
	SearchArgs                 = internal.SearchArgs
	ListProjectsArgs           = internal.ListProjectsArgs
	DeleteProjectArgs          = internal.DeleteProjectArgs
	ActiveProjectArgs          = internal.ActiveProjectArgs
	ListFeaturesByPriorityArgs = internal.ListFeaturesByPriorityArgs
	BrainConfig                = internal.BrainConfig
	ProjectConfig              = internal.ProjectConfig
	DefaultsConfig             = internal.DefaultsConfig
	SyncConfig                 = internal.SyncConfig
	LoggingConfig              = internal.LoggingConfig
	WatcherConfig              = internal.WatcherConfig
	MemoriesMode               = internal.MemoriesMode
	LogLevel                   = internal.LogLevel
)

// Re-export default values
var (
	BootstrapContextArgsDefaults       = internal.BootstrapContextArgsDefaults
	SearchArgsDefaults                 = internal.SearchArgsDefaults
	DeleteProjectArgsDefaults          = internal.DeleteProjectArgsDefaults
	ActiveProjectArgsDefaults          = internal.ActiveProjectArgsDefaults
	ListFeaturesByPriorityArgsDefaults = internal.ListFeaturesByPriorityArgsDefaults
	BrainConfigDefaults                = internal.BrainConfigDefaults
)

// Re-export MemoriesMode constants
const (
	MemoriesModeDefault = internal.MemoriesModeDefault
	MemoriesModeCode    = internal.MemoriesModeCode
	MemoriesModeCustom  = internal.MemoriesModeCustom
)

// Re-export LogLevel constants
const (
	LogLevelTrace = internal.LogLevelTrace
	LogLevelDebug = internal.LogLevelDebug
	LogLevelInfo  = internal.LogLevelInfo
	LogLevelWarn  = internal.LogLevelWarn
	LogLevelError = internal.LogLevelError
)

// Mergeable state type and constants
type MergeableState = internal.MergeableState

var (
	MergeableConflicting = internal.MergeableConflicting
	MergeableMergeable   = internal.MergeableMergeable
	MergeableUnknown     = internal.MergeableUnknown
)

// Re-export invoker constants
const (
	OperationSetup   = internal.OperationSetup
	OperationStatus  = internal.OperationStatus
	OperationCleanup = internal.OperationCleanup
	OperationAll     = internal.OperationAll
)

// Re-export naming patterns
var NamingPatterns = internal.NamingPatterns

// Re-export gh command patterns
var GhCommandPatterns = internal.GhCommandPatterns

// Validator functions
var (
	ValidateConsistency                 = internal.ValidateConsistency
	ValidateConsistencyFromContent      = internal.ValidateConsistencyFromContent
	ValidateNamingConvention            = internal.ValidateNamingConvention
	FindFeatureArtifacts                = internal.FindFeatureArtifacts
	GetAllFeatures                      = internal.GetAllFeatures
	ValidateScopeAlignment              = internal.ValidateScopeAlignment
	ValidateRequirementCoverage         = internal.ValidateRequirementCoverage
	ValidateNamingConventions           = internal.ValidateNamingConventions
	ValidateCrossReferences             = internal.ValidateCrossReferences
	ValidateTaskCompletion              = internal.ValidateTaskCompletion
	ValidateAllFeatures                 = internal.ValidateAllFeatures
	ValidateArtifactNaming              = internal.ValidateArtifactNaming
	ValidateSessionProtocol             = internal.ValidateSessionProtocol
	ValidateSessionProtocolFromContent  = internal.ValidateSessionProtocolFromContent
	ValidatePrePR                       = internal.ValidatePrePR
	ValidatePrePRWithConfig             = internal.ValidatePrePRWithConfig
	ValidatePrePRFromContent            = internal.ValidatePrePRFromContent
	DefaultPrePRConfig                  = internal.DefaultPrePRConfig
	ValidateCrossCuttingConcerns        = internal.ValidateCrossCuttingConcerns
	ValidateFailSafeDesign              = internal.ValidateFailSafeDesign
	ValidateCIEnvironment               = internal.ValidateCIEnvironment
	ValidateEnvironmentVariables        = internal.ValidateEnvironmentVariables
	ValidateSkillFormat                 = internal.ValidateSkillFormat
	ValidateSkillFormatFromContent      = internal.ValidateSkillFormatFromContent
	ValidateMemoryIndex                 = internal.ValidateMemoryIndex
	ValidateMemoryIndexFromContent      = internal.ValidateMemoryIndexFromContent
	ValidatePRDescription               = internal.ValidatePRDescription
	ValidatePRDescriptionWithConfig     = internal.ValidatePRDescriptionWithConfig
	ValidatePRDescriptionFull           = internal.ValidatePRDescriptionFull
	ValidatePRDescriptionSections       = internal.ValidatePRDescriptionSections
	ValidatePRChecklist                 = internal.ValidatePRChecklist
	DefaultPRDescriptionConfig          = internal.DefaultPRDescriptionConfig
	ValidateTraceability                = internal.ValidateTraceability
	ValidateTraceabilityFromContent     = internal.ValidateTraceabilityFromContent
	ValidateSlashCommand                = internal.ValidateSlashCommand
	ValidateSlashCommandFromContent     = internal.ValidateSlashCommandFromContent
	ValidateSession                     = internal.ValidateSession
	ValidateSessionState                = internal.ValidateSessionState
	ValidateStopReadiness               = internal.ValidateStopReadiness
	ValidateWorkflow                    = internal.ValidateWorkflow
	CheckQASkipEligibility              = internal.CheckQASkipEligibility
	ValidateTestImplementationAlignment = internal.ValidateTestImplementationAlignment
	ValidateChecklist                   = internal.ValidateChecklist
	ExtractSection                      = internal.ExtractSection
	CheckBrainInitialization            = internal.CheckBrainInitialization
	CheckBrainUpdate                    = internal.CheckBrainUpdate
	CheckBranchDocumented               = internal.CheckBranchDocumented
	CheckCommitEvidence                 = internal.CheckCommitEvidence
	CheckLintEvidence                   = internal.CheckLintEvidence
)

// Bootstrap validation functions
var (
	ValidateBootstrapContextArgs   = internal.ValidateBootstrapContextArgs
	ParseBootstrapContextArgs      = internal.ParseBootstrapContextArgs
	GetBootstrapContextArgsErrors  = internal.GetBootstrapContextArgsErrors
)

// Search validation functions
var (
	ValidateSearchArgs  = internal.ValidateSearchArgs
	ParseSearchArgs     = internal.ParseSearchArgs
	GetSearchArgsErrors = internal.GetSearchArgsErrors
)

// Projects validation functions
var (
	ValidateListProjectsArgs   = internal.ValidateListProjectsArgs
	ParseListProjectsArgs      = internal.ParseListProjectsArgs
	GetListProjectsArgsErrors  = internal.GetListProjectsArgsErrors
	ValidateDeleteProjectArgs  = internal.ValidateDeleteProjectArgs
	ParseDeleteProjectArgs     = internal.ParseDeleteProjectArgs
	GetDeleteProjectArgsErrors = internal.GetDeleteProjectArgsErrors
	ValidateActiveProjectArgs  = internal.ValidateActiveProjectArgs
	ParseActiveProjectArgs     = internal.ParseActiveProjectArgs
	GetActiveProjectArgsErrors = internal.GetActiveProjectArgsErrors
)

// ListFeaturesByPriority validation functions
var (
	ValidateListFeaturesByPriorityArgs  = internal.ValidateListFeaturesByPriorityArgs
	ParseListFeaturesByPriorityArgs     = internal.ParseListFeaturesByPriorityArgs
	GetListFeaturesByPriorityArgsErrors = internal.GetListFeaturesByPriorityArgsErrors
)

// BrainConfig validation functions
var (
	ValidateBrainConfig  = internal.ValidateBrainConfig
	ParseBrainConfig     = internal.ParseBrainConfig
	GetBrainConfigErrors = internal.GetBrainConfigErrors
	DefaultBrainConfig   = internal.DefaultBrainConfig
)

// Workflow validation functions (schema-based)
var (
	ValidateWorkflowState  = internal.ValidateWorkflowState
	ParseWorkflowState     = internal.ParseWorkflowState
	GetWorkflowStateErrors = internal.GetWorkflowStateErrors
)

// Project resolution function
var ResolveProject = internal.ResolveProject

// Detector functions and variables
var (
	DetectScenario                    = internal.DetectScenario
	DetectSkillViolations             = internal.DetectSkillViolations
	DetectSkillViolationsFromContent  = internal.DetectSkillViolationsFromContent
	ScanFileForViolations             = internal.ScanFileForViolations
	DetectTestCoverageGaps            = internal.DetectTestCoverageGaps
	DetectTestCoverageGapsForLanguage = internal.DetectTestCoverageGapsForLanguage
	DetectTestCoverageGapsStaged      = internal.DetectTestCoverageGapsStaged
	GetSupportedLanguages             = internal.GetSupportedLanguages
	AddLanguageConfig                 = internal.AddLanguageConfig
	LanguageConfigs                   = internal.LanguageConfigs
)

// Checker functions
var (
	CheckSkillExists    = internal.CheckSkillExists
	CheckTasks          = internal.CheckTasks
	ListSkills          = internal.ListSkills
	ValidateAllSkills   = internal.ValidateAllSkills
	CheckSkillScript    = internal.CheckSkillScript
	ListSkillScripts    = internal.ListSkillScripts
	ListAllSkillScripts = internal.ListAllSkillScripts
)

// Invoker functions
var (
	RunBatchPRReview           = internal.RunBatchPRReview
	RunBatchPRReviewWithRunner = internal.RunBatchPRReviewWithRunner
	GetRepoRoot                = internal.GetRepoRoot
	GetPRBranch                = internal.GetPRBranch
	CreatePRWorktree           = internal.CreatePRWorktree
	GetWorktreeStatus          = internal.GetWorktreeStatus
	PushWorktreeChanges        = internal.PushWorktreeChanges
	RemovePRWorktree           = internal.RemovePRWorktree
	AnalyzePRs                 = internal.AnalyzePRs
	FormatMaintenanceOutput    = internal.FormatMaintenanceOutput
	ParsePRsFromJSON           = internal.ParsePRsFromJSON
	DefaultPRMaintenanceConfig = internal.DefaultPRMaintenanceConfig
	GetBotAuthorInfo           = internal.GetBotAuthorInfo
	IsBotReviewer              = internal.IsBotReviewer
	PRHasConflicts             = internal.PRHasConflicts
	PRHasFailingChecks         = internal.PRHasFailingChecks
)

// Bot category type and constants
type BotCategory = internal.BotCategory

const (
	BotCategoryAgentControlled  = internal.BotCategoryAgentControlled
	BotCategoryMentionTriggered = internal.BotCategoryMentionTriggered
	BotCategoryReviewBot        = internal.BotCategoryReviewBot
	BotCategoryHuman            = internal.BotCategoryHuman
)

// Check state constants
const (
	CheckStateSuccess = internal.CheckStateSuccess
	CheckStateFailure = internal.CheckStateFailure
	CheckStateError   = internal.CheckStateError
	CheckStatePending = internal.CheckStatePending
)

// Check conclusion constants
const (
	ConclusionSuccess = internal.ConclusionSuccess
	ConclusionFailure = internal.ConclusionFailure
	ConclusionNeutral = internal.ConclusionNeutral
	ConclusionSkipped = internal.ConclusionSkipped
)
