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
	projectsActiveProject string
	projectsCodePath      string
	projectsNotesPath     string
	projectsName          string
	projectsDeleteProject string
	projectsDeleteNotes   bool
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

Notes path options (--notes-path):
  DEFAULT    Use ${default_notes_path}/${project_name} from brain-config.json (default)
  CODE       Use ${code_path}/docs
  <path>     Use any absolute path (must start with / or ~)

When --notes-path is not specified, it defaults to 'DEFAULT' mode.

Examples:
  brain projects list
  brain projects active -p myproject
  brain projects create --name myproject --code-path ~/Dev/myproject
  brain projects create --name myproject --code-path ~/Dev/myproject --notes-path CODE
  brain projects delete --project myproject
  brain projects delete --project myproject --delete-notes
  brain projects myproject
  brain projects myproject --code-path ~/Dev/myproject --notes-path DEFAULT`,
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
  --notes-path Notes directory path (default: 'DEFAULT'). Options:
               - 'DEFAULT': ${default_notes_path}/${project_name} (from brain-config.json)
               - 'CODE': ${code_path}/docs
               - Absolute path: Any custom path (must start with / or ~)

When --notes-path is not specified, 'DEFAULT' mode is used, which stores notes
in ${default_notes_path}/${project_name} as configured in brain-config.json.

To store notes alongside code (legacy behavior), use --notes-path CODE.

Examples:
  brain projects create --name myproject --code-path ~/Dev/myproject
  brain projects create --name myproject --code-path ~/Dev/myproject --notes-path CODE
  brain projects create --name myproject --code-path ~/Dev/myproject --notes-path ~/memories/myproject`,
	RunE: runProjectsCreate,
}

var projectsDeleteCmd = &cobra.Command{
	Use:   "delete",
	Short: "Delete a project",
	Long: `Delete a Brain memory project from configuration.

Required flags:
  --project      Project name to delete

Optional flags:
  --delete-notes Also delete the notes directory (default: false)
                 WARNING: This permanently deletes all note files!

Behavior:
  Without --delete-notes (default):
    - Removes project from brain-config.json and basic-memory config.json
    - Preserves the notes directory for manual recovery or re-registration
    - Safe operation: notes remain intact at their original location

  With --delete-notes:
    - Removes project from both configuration files
    - PERMANENTLY DELETES the notes directory and ALL contents
    - Requires double confirmation to prevent accidental data loss
    - Cannot be undone - ensure you have backups

Recovery:
  Config-only deletion: Use 'brain projects create' to re-register with existing notes
  Full deletion: Restore from backup (Git, Time Machine, etc.)

Examples:
  brain projects delete --project myproject                  # Config only
  brain projects delete --project myproject --delete-notes   # Full deletion`,
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
	projectsCreateCmd.Flags().StringVar(&projectsNotesPath, "notes-path", "", "Notes directory path (default: 'DEFAULT'). Options: 'DEFAULT', 'CODE', or absolute path")
	projectsCreateCmd.MarkFlagRequired("name")
	projectsCreateCmd.MarkFlagRequired("code-path")

	// Flags for delete command
	projectsDeleteCmd.Flags().StringVar(&projectsDeleteProject, "project", "", "Project name to delete (required)")
	projectsDeleteCmd.Flags().BoolVar(&projectsDeleteNotes, "delete-notes", false, "Also delete the notes directory (DESTRUCTIVE)")
	projectsDeleteCmd.MarkFlagRequired("project")

	// Flags for root command (editing project)
	projectsCmd.Flags().StringVar(&projectsCodePath, "code-path", "", "Set code directory path for project")
	projectsCmd.Flags().StringVar(&projectsNotesPath, "notes-path", "", "Notes directory path (default: 'DEFAULT'). Options: 'DEFAULT', 'CODE', or absolute path")
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

// validateNotesPath checks if notes_path value is valid and prints hints for invalid values.
// Returns true if valid, false if invalid.
// Valid values: "DEFAULT", "CODE", absolute path starting with / or ~
func validateNotesPath(notesPath string) bool {
	if notesPath == "" {
		return true // Empty is valid (uses default)
	}

	// Check for enum values (case-sensitive)
	if notesPath == "DEFAULT" || notesPath == "CODE" {
		return true
	}

	// Check for absolute path
	if len(notesPath) > 0 && (notesPath[0] == '/' || notesPath[0] == '~') {
		return true
	}

	// Invalid value - print hints
	fmt.Fprintf(os.Stderr, "Warning: Invalid notes-path value '%s'\n", notesPath)
	fmt.Fprintf(os.Stderr, "Valid options:\n")
	fmt.Fprintf(os.Stderr, "  DEFAULT  Use ${default_notes_path}/${project_name}\n")
	fmt.Fprintf(os.Stderr, "  CODE     Use ${code_path}/docs\n")
	fmt.Fprintf(os.Stderr, "  <path>   Absolute path starting with / or ~\n")
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
		Project   string  `json:"project"`
		NotesPath *string `json:"notes_path"`
		CodePath  *string `json:"code_path"`
		IsActive  bool    `json:"isActive"`
	}
	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	fmt.Printf("Project: %s\n", response.Project)
	if response.IsActive {
		fmt.Println("Status:  Active")
	}
	if response.NotesPath != nil && *response.NotesPath != "" {
		fmt.Printf("Notes:   %s\n", *response.NotesPath)
	}
	if response.CodePath != nil && *response.CodePath != "" {
		fmt.Printf("Code:    %s\n", *response.CodePath)
	} else {
		fmt.Println("Code:    (not configured)")
	}

	return nil
}

// editProject updates project configuration
func editProject(project, codePath string) error {
	// Validate notes_path before making request
	if !validateNotesPath(projectsNotesPath) {
		return fmt.Errorf("invalid notes-path value: %s", projectsNotesPath)
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

	// Add notes_path if provided
	if projectsNotesPath != "" {
		args["notes_path"] = projectsNotesPath
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
	// Validate notes_path before making request
	if !validateNotesPath(projectsNotesPath) {
		return fmt.Errorf("invalid notes-path value: %s", projectsNotesPath)
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

	// Add notes_path if provided
	if projectsNotesPath != "" {
		toolArgs["notes_path"] = projectsNotesPath
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
	fmt.Printf("Code path:  %s\n", response.CodePath)
	fmt.Printf("Notes path: %s\n", response.NotesPath)

	return nil
}

// runProjectsDelete handles 'brain projects delete'
func runProjectsDelete(cmd *cobra.Command, args []string) error {
	project := projectsDeleteProject
	deleteNotes := projectsDeleteNotes

	// First, get project details to show the notes path in confirmation
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

	// Parse response to check if project exists and get notes path
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
		Project   string  `json:"project"`
		NotesPath *string `json:"notes_path"`
		CodePath  *string `json:"code_path"`
	}
	if err := json.Unmarshal([]byte(detailsText), &projectDetails); err != nil {
		fmt.Fprintf(os.Stderr, "Error parsing project details: %v\n", err)
		return err
	}

	notesPath := ""
	if projectDetails.NotesPath != nil {
		notesPath = *projectDetails.NotesPath
	}

	// Interactive confirmation
	reader := bufio.NewReader(os.Stdin)

	if deleteNotes {
		// Double confirmation for destructive operation
		// First confirmation
		fmt.Printf("Delete project '%s'? Notes WILL BE DELETED. (yes/no): ", project)
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
		fmt.Printf("\n[WARNING] This will permanently delete notes at:\n  %s\n\n", notesPath)

		// Get file count for display
		fileCount := getFileCountFromServer(brainClient, project, notesPath)
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

	// Execute deletion
	result, err := brainClient.CallTool("delete_project", map[string]any{
		"project":      project,
		"delete_notes": deleteNotes,
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
		Project       string  `json:"project"`
		DeletedConfig bool    `json:"deleted_config"`
		DeletedNotes  bool    `json:"deleted_notes"`
		NotesPath     *string `json:"notes_path"`
		CodePath      *string `json:"code_path"`
		FilesRemoved  int     `json:"files_removed,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &response); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	// Display results
	fmt.Printf("[PASS] Deleted project: %s\n", response.Project)
	if response.DeletedConfig {
		fmt.Println("       Config removed: brain-config.json, basic-memory config.json")
	}
	if response.DeletedNotes {
		if response.NotesPath != nil {
			if response.FilesRemoved > 0 {
				fmt.Printf("       Notes deleted: %s (%d files removed)\n", *response.NotesPath, response.FilesRemoved)
			} else {
				fmt.Printf("       Notes deleted: %s\n", *response.NotesPath)
			}
		}
	} else if response.NotesPath != nil && *response.NotesPath != "" {
		fmt.Printf("       Notes preserved: %s\n", *response.NotesPath)
	}

	return nil
}

// getFileCountFromServer attempts to get file count from the server
// Returns 0 if unable to determine (fail-safe)
func getFileCountFromServer(brainClient *client.BrainClient, project, notesPath string) int {
	// The MCP tool doesn't expose file count before deletion,
	// so we return 0 and let the server report the count in the response
	// This is a fail-safe design - we don't block on missing information
	return 0
}
