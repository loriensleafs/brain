// Package cmd provides CLI commands for Brain TUI including project management.
//
// The projects command provides a unified interface for managing Brain memory projects,
// including listing, getting details, setting active project, creating, and editing configuration.
//
// Usage:
//
//	brain projects list
//	brain projects active [--project <name>]
//	brain projects create --name X --code-path Y [--notes-path Z]
//	brain projects <project>
//	brain projects <project> --code-path Y [--notes-path Z]
package cmd

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var (
	projectsActiveProject  string
	projectsCodePath       string
	projectsMemoriesPath   string // New flag name (ADR-020)
	projectsNotesPath      string // Deprecated, kept for backward compatibility
	projectsName           string
	projectsDeleteProject  string
	projectsDeleteMemories bool // New flag name (ADR-020)
	projectsDeleteNotes    bool // Deprecated, kept for backward compatibility
)

var projectsCmd = &cobra.Command{
	Use:   "projects [project]",
	Short: "Manage Brain memory projects",
	Long: `Manage Brain memory projects.

Commands:
  brain projects list              List all available projects
  brain projects active            Get current active project
  brain projects active -p NAME    Set active project
  brain projects create            Create a new project
  brain projects delete            Delete a project
  brain projects <project>         Get project details
  brain projects <project> --code-path PATH   Update project code path

Memories path options (--memories-path):
  DEFAULT    Use ${memories_location}/${project_name} from config (default)
  CODE       Use ${code_path}/docs
  <path>     Use any absolute path (must start with / or ~)

When --memories-path is not specified, it defaults to 'DEFAULT' mode.

Examples:
  brain projects list
  brain projects active -p myproject
  brain projects create --name myproject --code-path ~/Dev/myproject
  brain projects create --name myproject --code-path ~/Dev/myproject --memories-path CODE
  brain projects delete --project myproject
  brain projects delete --project myproject --delete-memories
  brain projects myproject
  brain projects myproject --code-path ~/Dev/myproject --memories-path DEFAULT`,
	Args: cobra.MaximumNArgs(1),
	RunE: runProjectsRoot,
}

var projectsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all available projects",
	Long:  `Lists all Brain memory projects and their configured code paths.`,
	RunE:  runProjectsList,
}

var projectsActiveCmd = &cobra.Command{
	Use:   "active",
	Short: "Get or set the active project",
	Long: `Get or set the active project for this session.

Without flags, returns the current active project.
With -p/--project, sets the active project.

Examples:
  brain projects active           Get current active project
  brain projects active -p brain  Set active project to 'brain'`,
	RunE: runProjectsActive,
}

var projectsCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new project",
	Long: `Create a new Brain memory project.

Required flags:
  --name       Project name
  --code-path  Code directory path

Optional flags:
  --memories-path  Memories directory path (default: 'DEFAULT'). Options:
                   - 'DEFAULT': ${memories_location}/${project_name} (from config)
                   - 'CODE': ${code_path}/docs
                   - Absolute path: Any custom path (must start with / or ~)

When --memories-path is not specified, 'DEFAULT' mode is used, which stores
memories in ${memories_location}/${project_name} as configured.

To store memories alongside code (legacy behavior), use --memories-path CODE.

DEPRECATED: --notes-path is deprecated, use --memories-path instead.

Examples:
  brain projects create --name myproject --code-path ~/Dev/myproject
  brain projects create --name myproject --code-path ~/Dev/myproject --memories-path CODE
  brain projects create --name myproject --code-path ~/Dev/myproject --memories-path ~/memories/myproject`,
	RunE: runProjectsCreate,
}

var projectsDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete a project",
	Long: `Delete a Brain memory project from configuration.

Required flags:
  --project          Project name to delete

Optional flags:
  --delete-memories  Also delete the memories directory (default: false)
                     WARNING: This permanently deletes all memory files!

Behavior:
  Without --delete-memories (default):
    - Removes project from brain-config.json and basic-memory config.json
    - Preserves the memories directory for manual recovery or re-registration
    - Safe operation: memories remain intact at their original location

  With --delete-memories:
    - Removes project from both configuration files
    - PERMANENTLY DELETES the memories directory and ALL contents
    - Requires double confirmation to prevent accidental data loss
    - Cannot be undone - ensure you have backups

Recovery:
  Config-only deletion: Use 'brain projects create' to re-register with existing memories
  Full deletion: Restore from backup (Git, Time Machine, etc.)

DEPRECATED: --delete-notes is deprecated, use --delete-memories instead.

Examples:
  brain projects delete --project myproject                      # Config only
  brain projects delete --project myproject --delete-memories    # Full deletion`,
	RunE: runProjectsDelete,
}

func init() {
	rootCmd.AddCommand(projectsCmd)
	projectsCmd.AddCommand(projectsListCmd)
	projectsCmd.AddCommand(projectsActiveCmd)
	projectsCmd.AddCommand(projectsCreateCmd)
	projectsCmd.AddCommand(projectsDeleteCmd)

	// Flags for active command
	projectsActiveCmd.Flags().StringVarP(&projectsActiveProject, "project", "p", "", "Project name to set as active")

	// Flags for create command
	projectsCreateCmd.Flags().StringVar(&projectsName, "name", "", "Project name (required)")
	projectsCreateCmd.Flags().StringVar(&projectsCodePath, "code-path", "", "Code directory path (required)")
	projectsCreateCmd.Flags().StringVar(&projectsMemoriesPath, "memories-path", "", "Memories directory path (default: 'DEFAULT'). Options: 'DEFAULT', 'CODE', or absolute path")
	projectsCreateCmd.Flags().StringVar(&projectsNotesPath, "notes-path", "", "DEPRECATED: Use --memories-path instead")
	projectsCreateCmd.Flags().MarkDeprecated("notes-path", "use --memories-path instead")
	projectsCreateCmd.MarkFlagRequired("name")
	projectsCreateCmd.MarkFlagRequired("code-path")

	// Flags for delete command
	projectsDeleteCmd.Flags().StringVar(&projectsDeleteProject, "project", "", "Project name to delete (required)")
	projectsDeleteCmd.Flags().BoolVar(&projectsDeleteMemories, "delete-memories", false, "Also delete the memories directory (DESTRUCTIVE)")
	projectsDeleteCmd.Flags().BoolVar(&projectsDeleteNotes, "delete-notes", false, "DEPRECATED: Use --delete-memories instead")
	projectsDeleteCmd.Flags().MarkDeprecated("delete-notes", "use --delete-memories instead")
	projectsDeleteCmd.MarkFlagRequired("project")

	// Flags for root command (editing project)
	projectsCmd.Flags().StringVar(&projectsCodePath, "code-path", "", "Set code directory path for project")
	projectsCmd.Flags().StringVar(&projectsMemoriesPath, "memories-path", "", "Memories directory path (default: 'DEFAULT'). Options: 'DEFAULT', 'CODE', or absolute path")
	projectsCmd.Flags().StringVar(&projectsNotesPath, "notes-path", "", "DEPRECATED: Use --memories-path instead")
	projectsCmd.Flags().MarkDeprecated("notes-path", "use --memories-path instead")
}

// runProjectsRoot handles 'brain projects' and 'brain projects <project>'
func runProjectsRoot(cmd *cobra.Command, args []string) error {
	// If no args and no flags, show help
	if len(args) == 0 && projectsCodePath == "" {
		return cmd.Help()
	}

	// If we have a project argument, get details or edit
	if len(args) == 1 {
		project := args[0]

		// If editing flags provided, edit the project
		if projectsCodePath != "" {
			return editProject(project, projectsCodePath)
		}

		// Otherwise get project details
		return getProjectDetails(project)
	}

	return cmd.Help()
}

// runProjectsList handles 'brain projects list'
func runProjectsList(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	result, err := brainClient.CallTool("list_projects", map[string]any{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Parse and format output - handle both old and new response formats
	text := result.GetText()
	projects := parseProjectListResponse(text)

	// Format as table
	fmt.Println("Brain Memory Projects")
	fmt.Println("=====================")
	if len(projects) == 0 {
		fmt.Println("  (no projects configured)")
	} else {
		for _, proj := range projects {
			fmt.Printf("  %s\n", proj)
		}
	}

	return nil
}

// parseProjectListResponse handles both old format {projects: [], code_paths: {}} and new format ["project1", "project2"]
func parseProjectListResponse(text string) []string {
	// Try new format first: simple string array
	var newFormat []string
	if err := json.Unmarshal([]byte(text), &newFormat); err == nil {
		return newFormat
	}

	// Try old format: object with projects array and code_paths map
	var oldFormat struct {
		Projects  []string          `json:"projects"`
		CodePaths map[string]string `json:"code_paths"`
	}
	if err := json.Unmarshal([]byte(text), &oldFormat); err == nil {
		return oldFormat.Projects
	}

	// If neither format works, return empty slice
	return nil
}

// getEffectiveMemoriesPath returns the effective memories path, handling deprecated --notes-path flag.
// Priority: --memories-path > --notes-path (with warning) > empty
func getEffectiveMemoriesPath() string {
	if projectsMemoriesPath != "" {
		return projectsMemoriesPath
	}
	if projectsNotesPath != "" {
		// Deprecated flag used - Cobra already prints deprecation warning via MarkDeprecated
		return projectsNotesPath
	}
	return ""
}

// validateMemoriesPath checks if memories_path value is valid and prints hints for invalid values.
// Returns true if valid, false if invalid.
// Valid values: "DEFAULT", "CODE", absolute path starting with / or ~
func validateMemoriesPath(memoriesPath string) bool {
	if memoriesPath == "" {
		return true // Empty is valid (uses default)
	}

	// Check for enum values (case-sensitive)
	if memoriesPath == "DEFAULT" || memoriesPath == "CODE" {
		return true
	}

	// Check for absolute path
	if len(memoriesPath) > 0 && (memoriesPath[0] == '/' || memoriesPath[0] == '~') {
		return true
	}

	// Invalid value - print hints
	fmt.Fprintf(os.Stderr, "Warning: Invalid memories-path value '%s'\n", memoriesPath)
	fmt.Fprintf(os.Stderr, "Valid options:\n")
	fmt.Fprintf(os.Stderr, "  DEFAULT  Use ${memories_location}/${project_name}\n")
	fmt.Fprintf(os.Stderr, "  CODE     Use ${code_path}/docs\n")
	fmt.Fprintf(os.Stderr, "  <path>   Absolute path starting with / or ~\n")
	return false
}

// getEffectiveDeleteMemories returns the effective delete-memories flag, handling deprecated --delete-notes flag.
// Priority: --delete-memories > --delete-notes (with warning)
func getEffectiveDeleteMemories() bool {
	if projectsDeleteMemories {
		return true
	}
	if projectsDeleteNotes {
		// Deprecated flag used - Cobra already prints deprecation warning via MarkDeprecated
		return true
	}
	return false
}

// runProjectsActive handles 'brain projects active' and 'brain projects active -p NAME'
func runProjectsActive(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// If project specified, set it
	if projectsActiveProject != "" {
		result, err := brainClient.CallTool("active_project", map[string]any{
			"operation": "set",
			"project":   projectsActiveProject,
		})
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error: %v\n", err)
			return err
		}
		fmt.Println(result.GetText())
		return nil
	}

	// Otherwise get current active project
	result, err := brainClient.CallTool("active_project", map[string]any{
		"operation": "get",
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Parse and format output
	text := result.GetText()
	var response struct {
		ActiveProject   *string  `json:"active_project"`
		ResolvedProject *string  `json:"resolved_project"`
		Hierarchy       []string `json:"resolution_hierarchy"`
	}
	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	if response.ActiveProject != nil && *response.ActiveProject != "" {
		fmt.Printf("Active: %s\n", *response.ActiveProject)
	} else if response.ResolvedProject != nil && *response.ResolvedProject != "" {
		fmt.Printf("Resolved: %s (auto-detected)\n", *response.ResolvedProject)
	} else {
		fmt.Println("No active project")
	}

	return nil
}

// getProjectDetails retrieves and displays project details
func getProjectDetails(project string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	result, err := brainClient.CallTool("get_project_details", map[string]any{
		"project": project,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Parse and format output
	text := result.GetText()

	// Check for error response (project not found)
	var errorResponse struct {
		Error             string   `json:"error"`
		AvailableProjects []string `json:"available_projects"`
	}
	if err := json.Unmarshal([]byte(text), &errorResponse); err == nil && errorResponse.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", errorResponse.Error)
		if len(errorResponse.AvailableProjects) > 0 {
			fmt.Fprintf(os.Stderr, "Available projects:\n")
			for _, p := range errorResponse.AvailableProjects {
				fmt.Fprintf(os.Stderr, "  - %s\n", p)
			}
		}
		return fmt.Errorf(errorResponse.Error)
	}

	var response struct {
		Project      string  `json:"project"`
		MemoriesPath *string `json:"memories_path"` // New field name
		NotesPath    *string `json:"notes_path"`    // Fallback for old MCP responses
		CodePath     *string `json:"code_path"`
		IsActive     bool    `json:"isActive"`
	}
	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	// Get memories path (prefer new field name, fall back to old)
	var memoriesPath *string
	if response.MemoriesPath != nil {
		memoriesPath = response.MemoriesPath
	} else {
		memoriesPath = response.NotesPath
	}

	fmt.Printf("Project:  %s\n", response.Project)
	if response.IsActive {
		fmt.Println("Status:   Active")
	}
	if memoriesPath != nil && *memoriesPath != "" {
		fmt.Printf("Memories: %s\n", *memoriesPath)
	}
	if response.CodePath != nil && *response.CodePath != "" {
		fmt.Printf("Code:     %s\n", *response.CodePath)
	} else {
		fmt.Println("Code:     (not configured)")
	}

	return nil
}

// editProject updates project configuration
func editProject(project, codePath string) error {
	// Get effective memories path (handles deprecated flag)
	effectiveMemoriesPath := getEffectiveMemoriesPath()

	// Validate memories_path before making request
	if !validateMemoriesPath(effectiveMemoriesPath) {
		return fmt.Errorf("invalid memories-path value: %s", effectiveMemoriesPath)
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	args := map[string]any{
		"name":      project,
		"code_path": codePath,
	}

	// Add memories_path if provided (MCP tool accepts both old and new names)
	if effectiveMemoriesPath != "" {
		args["memories_path"] = effectiveMemoriesPath
	}

	result, err := brainClient.CallTool("edit_project", args)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Check for error response
	text := result.GetText()
	var errorResponse struct {
		Error             string   `json:"error"`
		AvailableProjects []string `json:"available_projects"`
	}
	if err := json.Unmarshal([]byte(text), &errorResponse); err == nil && errorResponse.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", errorResponse.Error)
		if len(errorResponse.AvailableProjects) > 0 {
			fmt.Fprintf(os.Stderr, "Available projects:\n")
			for _, p := range errorResponse.AvailableProjects {
				fmt.Fprintf(os.Stderr, "  - %s\n", p)
			}
		}
		return fmt.Errorf(errorResponse.Error)
	}

	fmt.Println(text)
	return nil
}

// runProjectsCreate handles 'brain projects create'
func runProjectsCreate(cmd *cobra.Command, args []string) error {
	// Get effective memories path (handles deprecated flag)
	effectiveMemoriesPath := getEffectiveMemoriesPath()

	// Validate memories_path before making request
	if !validateMemoriesPath(effectiveMemoriesPath) {
		return fmt.Errorf("invalid memories-path value: %s", effectiveMemoriesPath)
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	toolArgs := map[string]any{
		"name":      projectsName,
		"code_path": projectsCodePath,
	}

	// Add memories_path if provided (MCP tool accepts both old and new names)
	if effectiveMemoriesPath != "" {
		toolArgs["memories_path"] = effectiveMemoriesPath
	}

	result, err := brainClient.CallTool("create_project", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Check for error response
	text := result.GetText()
	var errorResponse struct {
		Error             string  `json:"error"`
		ExistingNotesPath *string `json:"existing_notes_path"`
		ExistingCodePath  *string `json:"existing_code_path"`
	}
	if err := json.Unmarshal([]byte(text), &errorResponse); err == nil && errorResponse.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", errorResponse.Error)
		if errorResponse.ExistingNotesPath != nil {
			fmt.Fprintf(os.Stderr, "Existing notes path: %s\n", *errorResponse.ExistingNotesPath)
		}
		if errorResponse.ExistingCodePath != nil {
			fmt.Fprintf(os.Stderr, "Existing code path: %s\n", *errorResponse.ExistingCodePath)
		}
		return fmt.Errorf(errorResponse.Error)
	}

	// Parse success response
	var response struct {
		Project   string `json:"project"`
		CodePath  string `json:"code_path"`
		NotesPath string `json:"notes_path"`
		Created   bool   `json:"created"`
	}
	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	fmt.Printf("Created project: %s\n", response.Project)
	fmt.Printf("Code path:     %s\n", response.CodePath)
	fmt.Printf("Memories path: %s\n", response.NotesPath)

	return nil
}

// runProjectsDelete handles 'brain projects delete'
func runProjectsDelete(cmd *cobra.Command, args []string) error {
	project := projectsDeleteProject
	deleteMemories := getEffectiveDeleteMemories()

	// First, get project details to show the memories path in confirmation
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Get project details to display in confirmation prompt
	detailsResult, err := brainClient.CallTool("get_project_details", map[string]any{
		"project": project,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Parse response to check if project exists and get memories path
	detailsText := detailsResult.GetText()
	var errorResponse struct {
		Error             string   `json:"error"`
		AvailableProjects []string `json:"available_projects"`
	}
	if err := json.Unmarshal([]byte(detailsText), &errorResponse); err == nil && errorResponse.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", errorResponse.Error)
		if len(errorResponse.AvailableProjects) > 0 {
			fmt.Fprintf(os.Stderr, "Available projects:\n")
			for _, p := range errorResponse.AvailableProjects {
				fmt.Fprintf(os.Stderr, "  - %s\n", p)
			}
		}
		os.Exit(1)
		return fmt.Errorf(errorResponse.Error)
	}

	var projectDetails struct {
		Project      string  `json:"project"`
		MemoriesPath *string `json:"memories_path"` // New field name
		NotesPath    *string `json:"notes_path"`    // Fallback for old MCP responses
		CodePath     *string `json:"code_path"`
	}
	if err := json.Unmarshal([]byte(detailsText), &projectDetails); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing project details: %v\n", err)
		return err
	}

	// Get memories path (prefer new field name, fall back to old)
	memoriesPath := ""
	if projectDetails.MemoriesPath != nil {
		memoriesPath = *projectDetails.MemoriesPath
	} else if projectDetails.NotesPath != nil {
		memoriesPath = *projectDetails.NotesPath
	}

	// Interactive confirmation
	reader := bufio.NewReader(os.Stdin)

	if deleteMemories {
		// Double confirmation for destructive operation
		// First confirmation
		fmt.Printf("Delete project '%s'? Memories WILL BE DELETED. (yes/no): ", project)
		response, err := reader.ReadString('\n')
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading input: %v\n", err)
			os.Exit(1)
			return err
		}
		response = strings.TrimSpace(strings.ToLower(response))
		if response != "yes" && response != "y" {
			fmt.Println("Deletion cancelled.")
			os.Exit(1)
			return nil
		}

		// Second confirmation with full path display (security requirement from TM-001)
		fmt.Printf("\n[WARNING] This will permanently delete memories at:\n  %s\n\n", memoriesPath)

		// Get file count for display
		fileCount := getFileCountFromServer(brainClient, project, memoriesPath)
		if fileCount > 0 {
			fmt.Printf("This will permanently delete %d files.\n", fileCount)
		}

		fmt.Printf("Type the project name '%s' to confirm: ", project)
		confirmName, err := reader.ReadString('\n')
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading input: %v\n", err)
			os.Exit(1)
			return err
		}
		confirmName = strings.TrimSpace(confirmName)
		if confirmName != project {
			fmt.Fprintf(os.Stderr, "Project name does not match. Deletion cancelled.\n")
			os.Exit(1)
			return nil
		}
	} else {
		// Single confirmation for config-only deletion
		fmt.Printf("Delete project '%s' from configuration? (yes/no): ", project)
		response, err := reader.ReadString('\n')
		if err != nil {
			fmt.Fprintf(os.Stderr, "Error reading input: %v\n", err)
			os.Exit(1)
			return err
		}
		response = strings.TrimSpace(strings.ToLower(response))
		if response != "yes" && response != "y" {
			fmt.Println("Deletion cancelled.")
			os.Exit(1)
			return nil
		}
	}

	// Execute deletion (MCP tool accepts both old and new field names)
	result, err := brainClient.CallTool("delete_project", map[string]any{
		"project":         project,
		"delete_memories": deleteMemories,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	// Parse and display results
	text := result.GetText()

	// Check for error response
	var deleteError struct {
		Error             string   `json:"error"`
		AvailableProjects []string `json:"available_projects"`
		Warning           string   `json:"warning"`
		Recovery          string   `json:"recovery"`
	}
	if err := json.Unmarshal([]byte(text), &deleteError); err == nil {
		if deleteError.Error != "" {
			fmt.Fprintf(os.Stderr, "Error: %s\n", deleteError.Error)
			if len(deleteError.AvailableProjects) > 0 {
				fmt.Fprintf(os.Stderr, "Available projects:\n")
				for _, p := range deleteError.AvailableProjects {
					fmt.Fprintf(os.Stderr, "  - %s\n", p)
				}
			}
			os.Exit(1)
			return fmt.Errorf(deleteError.Error)
		}
		if deleteError.Warning != "" {
			fmt.Fprintf(os.Stderr, "[WARNING] %s\n", deleteError.Warning)
			if deleteError.Recovery != "" {
				fmt.Fprintf(os.Stderr, "Recovery: %s\n", deleteError.Recovery)
			}
			os.Exit(1)
			return fmt.Errorf(deleteError.Warning)
		}
	}

	// Parse success response
	var response struct {
		Project         string  `json:"project"`
		DeletedConfig   bool    `json:"deleted_config"`
		DeletedMemories bool    `json:"deleted_memories"` // New field name
		DeletedNotes    bool    `json:"deleted_notes"`    // Fallback for old MCP responses
		MemoriesPath    *string `json:"memories_path"`    // New field name
		NotesPath       *string `json:"notes_path"`       // Fallback for old MCP responses
		CodePath        *string `json:"code_path"`
		FilesRemoved    int     `json:"files_removed,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	// Get effective deleted flag and path (prefer new field names, fall back to old)
	deletedMemories := response.DeletedMemories || response.DeletedNotes
	var memoriesPathResult *string
	if response.MemoriesPath != nil {
		memoriesPathResult = response.MemoriesPath
	} else {
		memoriesPathResult = response.NotesPath
	}

	// Display results
	fmt.Printf("[PASS] Deleted project: %s\n", response.Project)
	if response.DeletedConfig {
		fmt.Println("       Config removed: brain-config.json, basic-memory config.json")
	}
	if deletedMemories {
		if memoriesPathResult != nil {
			if response.FilesRemoved > 0 {
				fmt.Printf("       Memories deleted: %s (%d files removed)\n", *memoriesPathResult, response.FilesRemoved)
			} else {
				fmt.Printf("       Memories deleted: %s\n", *memoriesPathResult)
			}
		}
	} else if memoriesPathResult != nil && *memoriesPathResult != "" {
		fmt.Printf("       Memories preserved: %s\n", *memoriesPathResult)
	}

	return nil
}

// getFileCountFromServer attempts to get file count from the server
// Returns 0 if unable to determine (fail-safe)
func getFileCountFromServer(brainClient *client.BrainClient, project, memoriesPath string) int {
	// The MCP tool doesn't expose file count before deletion,
	// so we return 0 and let the server report the count in the response
	// This is a fail-safe design - we don't block on missing information
	return 0
}
