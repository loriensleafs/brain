// Package tui provides the interactive terminal user interface for Brain.
package tui

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"

	"github.com/peterkloss/brain-tui/client"

	"github.com/charmbracelet/bubbles/list"
	"github.com/charmbracelet/bubbles/spinner"
	"github.com/charmbracelet/bubbles/table"
	"github.com/charmbracelet/bubbles/textarea"
	"github.com/charmbracelet/bubbles/textinput"
	"github.com/charmbracelet/bubbles/viewport"
	tea "github.com/charmbracelet/bubbletea"
	"github.com/charmbracelet/glamour"
	"github.com/charmbracelet/lipgloss"
)

// Content state
type contentState int

const (
	stateSelectProject contentState = iota
	stateCreateProject
	stateMainMenu
	stateSearch
	stateLoading
	stateLoadingNote
	stateResults
	stateNote
	stateEditNote
	stateSavingNote
	stateConfirmDelete
	stateDeletingNote
	stateNoteInfo
	stateLoadingNoteInfo
	stateCreateNote
	stateRecent
	stateLoadingRecent
	stateBrowse
	stateLoadingBrowse
	stateProjectSettings
	stateConfirmDeleteProject
	stateDeletingProject
	stateMCPServer
)

// Menu items
const (
	menuSearch    = "Search notes"
	menuRecent    = "Recent activity"
	menuBrowse    = "Browse notes"
	menuWrite     = "Write new note"
	menuProject   = "Project settings"
	menuMCP       = "Start MCP server"
	createProject = "+ Create new project"
)

// Colors matching memory CLI
var (
	primaryColor = lipgloss.Color("#0074ff")
	dimColor     = lipgloss.Color("240")
	whiteColor   = lipgloss.Color("252")
)

// Styles
var (
	badgeStyle = lipgloss.NewStyle().
			Bold(true).
			Foreground(lipgloss.Color("#FFFFFF")).
			Background(primaryColor).
			Padding(0, 1)

	badgeVersionStyle = lipgloss.NewStyle().
				Bold(true).
				Foreground(primaryColor)

	helpStyle = lipgloss.NewStyle().
			Foreground(dimColor)

	helpKeyStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#ffffff")).
			Faint(true).
			Bold(true)

	helpDescStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("white")).
			Faint(true)

	helpSepStyle = lipgloss.NewStyle().
			Foreground(lipgloss.Color("#3C3C3C"))

	titleStyle = lipgloss.NewStyle().
			Foreground(primaryColor).
			Bold(true)
)

// SearchResult from memory CLI
type SearchResult struct {
	Title     string  `json:"title"`
	Type      string  `json:"type"`
	Score     float64 `json:"score"`
	Entity    string  `json:"entity"`
	Permalink string  `json:"permalink"`
	Content   string  `json:"content"`
}

type SearchResponse struct {
	Results   []SearchResult `json:"results"`
	Count     int            `json:"count"`
	Project   string         `json:"project"`
	Error     string         `json:"error"`
	Available []string       `json:"available"`
}

type ReadResponse struct {
	Content    string `json:"content"`
	Identifier string `json:"identifier"`
	Project    string `json:"project"`
}

// Messages
type searchResultsMsg struct {
	response SearchResponse
	err      error
}

type noteContentMsg struct {
	content  string
	rendered string
	title    string
	err      error
}

type createProjectMsg struct {
	name string
	err  error
}

type createNoteMsg struct {
	title string
	err   error
}

type saveNoteMsg struct {
	title string
	err   error
}

type deleteNoteMsg struct {
	title string
	err   error
}

// Note info/context types
type NoteConnection struct {
	Type   string `json:"type"`
	Target string `json:"target"`
}

type NoteObservation struct {
	Category string `json:"category"`
	Content  string `json:"content"`
}

type ContextResponse struct {
	URL          string            `json:"url"`
	Project      string            `json:"project"`
	Connections  []NoteConnection  `json:"connections"`
	Observations []NoteObservation `json:"observations"`
	Raw          string            `json:"raw"`
}

type noteInfoMsg struct {
	response ContextResponse
	err      error
}

type deleteProjectMsg struct {
	name string
	err  error
}

type mcpServerMsg struct {
	started bool
	err     error
}

// Recent activity result
type RecentResult struct {
	Title  string `json:"title"`
	Folder string `json:"folder"`
	Entity string `json:"entity"`
	Type   string `json:"type"`
}

type RecentResponse struct {
	Results []RecentResult `json:"results"`
	Count   int            `json:"count"`
	Project string         `json:"project"`
}

// GraphContext structs for build_context response parsing
type GraphContextResult struct {
	PrimaryResult GraphContextEntity `json:"primary_result"`
}

type GraphContextEntity struct {
	Type      string `json:"type"`
	Title     string `json:"title"`
	Permalink string `json:"permalink"`
	FilePath  string `json:"file_path"`
	CreatedAt string `json:"created_at"`
}

type GraphContextResponse struct {
	Results  []GraphContextResult `json:"results"`
	Metadata struct {
		URI       string `json:"uri"`
		Timeframe string `json:"timeframe"`
	} `json:"metadata"`
	Page     int `json:"page"`
	PageSize int `json:"page_size"`
}

type recentResultsMsg struct {
	response RecentResponse
	rawText  string // Fallback when JSON parsing fails
	err      error
}

// Directory listing result
type DirItem struct {
	Name  string `json:"name"`
	Path  string `json:"path"`
	Title string `json:"title,omitempty"`
	Date  string `json:"date,omitempty"`
	Type  string `json:"type"` // "directory" or "file"
	Size  int64  `json:"size,omitempty"`
}

type DirResponse struct {
	Items     []DirItem `json:"items"`
	Count     int       `json:"count"`
	Project   string    `json:"project"`
	Directory string    `json:"directory"`
}

type dirResultsMsg struct {
	response DirResponse
	rawText  string // Fallback when JSON parsing fails
	err      error
}

// Project item for list
type projectItem struct {
	name        string
	desc        string
	alwaysMatch bool // If true, always shows in filtered results
}

func (p projectItem) Title() string       { return p.name }
func (p projectItem) Description() string { return p.desc }
func (p projectItem) FilterValue() string {
	if p.alwaysMatch {
		return "" // Empty string matches everything in bubbles list
	}
	return p.name
}

// Menu item for list
type menuItem struct {
	name string
	desc string
}

func (m menuItem) Title() string       { return m.name }
func (m menuItem) Description() string { return m.desc }
func (m menuItem) FilterValue() string { return m.name }

// Form field indices for create project
const (
	projectFieldName = iota
	projectFieldPath
)

// Form field indices for create note
const (
	noteFieldTitle = iota
	noteFieldFolder
)

// Model
type model struct {
	state     contentState
	prevState contentState // Track previous state for back navigation
	project   string
	query     string
	client    *client.BrainClient // HTTP client for Brain MCP

	// Components
	textInput   textinput.Model
	spinner     spinner.Model
	table       table.Model
	viewport    viewport.Model
	projectList list.Model
	menuList    list.Model
	textarea    textarea.Model

	// Create project form
	projectFormInputs  []textinput.Model
	projectFormFocused int

	// Create note form
	noteFormInputs  []textinput.Model
	noteFormFocused int

	// Data
	results         []SearchResult
	recentResults   []RecentResult
	recentRawText   string // Fallback when recent_activity returns markdown
	dirItems        []DirItem
	dirRawText      string // Fallback when list_directory returns markdown
	currentDir      string // Current directory path for browsing
	noteTitle       string
	noteContent     string
	noteFolder      string // Folder for the current note (for saving)
	noteEntity      string // Entity identifier for the current note
	noteInfo        ContextResponse
	noteFocusInput  bool // True when focus is on search input vs viewport in note view
	projects        []string
	projectPaths    map[string]string // Cache of project name -> path
	projectsLoading bool              // True while fetching projects list

	// Cached renderer for performance
	mdRenderer *glamour.TermRenderer

	// Dimensions
	width  int
	height int

	// Confirm dialog
	confirmYes bool // true = Yes selected, false = No selected

	// Error
	err error
}

func initialModel(project string) model {
	// Text input
	ti := textinput.New()
	ti.CharLimit = 256
	ti.Width = 50
	ti.PromptStyle = lipgloss.NewStyle().Foreground(primaryColor)
	ti.Prompt = ""
	ti.TextStyle = lipgloss.NewStyle().Foreground(whiteColor)

	// Spinner
	s := spinner.New()
	s.Spinner = spinner.Line
	s.Style = lipgloss.NewStyle().Foreground(primaryColor)

	// Determine initial state - always start with project selection if no project provided
	initialState := stateMainMenu
	if project == "" {
		initialState = stateSelectProject
	}

	m := model{
		state:           initialState,
		project:         project,
		textInput:       ti,
		spinner:         s,
		projectsLoading: true, // Start with loading state
	}

	// Initialize project list with just the create option (shown immediately)
	if initialState == stateSelectProject {
		m.initProjectListWithCreate()
	}

	return m
}

// initialModelWithClient creates a model with an HTTP client already initialized
func initialModelWithClient(project string, c *client.BrainClient) model {
	m := initialModel(project)
	m.client = c
	return m
}

// getRenderer returns a cached glamour renderer, creating one if needed.
func (m *model) getRenderer(width int) *glamour.TermRenderer {
	if m.mdRenderer == nil {
		m.mdRenderer, _ = glamour.NewTermRenderer(
			glamour.WithStylePath("dark"),
			glamour.WithWordWrap(width),
		)
	}
	return m.mdRenderer
}

// getProjectPath returns the filesystem path for the current project.
// It reads from basic-memory's config file for fast lookup.
func (m model) getProjectPath() string {
	if m.project == "" {
		return ""
	}

	// Check cache first
	if m.projectPaths != nil {
		if path, ok := m.projectPaths[m.project]; ok {
			return path
		}
	}

	// Read basic-memory config directly (much faster than CLI)
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}

	configPath := home + "/.basic-memory/config.json"
	data, err := os.ReadFile(configPath)
	if err != nil {
		return ""
	}

	var config struct {
		Projects map[string]string `json:"projects"`
	}
	if err := json.Unmarshal(data, &config); err != nil {
		return ""
	}

	if path, ok := config.Projects[m.project]; ok {
		return path
	}
	return ""
}

func (m model) Init() tea.Cmd {
	if m.state == stateSelectProject {
		return tea.Batch(m.spinner.Tick, m.fetchProjects())
	}
	return textinput.Blink
}

// Message for project list
type projectsMsg struct {
	projects []string
	err      error
}

func (m model) fetchProjects() tea.Cmd {
	c := m.client
	return func() tea.Msg {
		// Call list_memory_projects via HTTP
		result, err := c.CallTool("list_memory_projects", map[string]interface{}{})
		if err != nil {
			return projectsMsg{err: err}
		}

		// Parse the result to extract project names
		text := result.GetText()
		var projects []string

		// Try to parse as JSON first
		var projectList struct {
			Projects []struct {
				Name string `json:"name"`
			} `json:"projects"`
		}
		if err := json.Unmarshal([]byte(text), &projectList); err == nil {
			for _, p := range projectList.Projects {
				projects = append(projects, p.Name)
			}
		} else {
			// Fallback: parse as lines containing project names (bullet format)
			// basic-memory returns: "* project_name" format
			lines := strings.Split(text, "\n")
			for _, line := range lines {
				line = strings.TrimSpace(line)
				// Handle bullet point format: "* project_name"
				if strings.HasPrefix(line, "* ") {
					projectName := strings.TrimPrefix(line, "* ")
					projects = append(projects, projectName)
				}
			}
		}

		return projectsMsg{projects: projects}
	}
}

func (m model) Update(msg tea.Msg) (tea.Model, tea.Cmd) {
	var cmd tea.Cmd
	var cmds []tea.Cmd

	switch msg := msg.(type) {
	case tea.KeyMsg:
		switch msg.String() {
		case "ctrl+c":
			return m, tea.Quit
		case "q":
			if m.state == stateSelectProject && !m.projectList.SettingFilter() {
				return m, tea.Quit
			}
		case "esc":
			switch m.state {
			case stateSelectProject:
				return m, tea.Quit
			case stateCreateProject:
				// Go back to project selection
				m.state = stateSelectProject
				return m, nil
			case stateMainMenu:
				// Go back to project selection
				m.state = stateSelectProject
				return m, nil
			case stateSearch, stateResults, stateRecent:
				// Go back to main menu
				m.state = stateMainMenu
				m.menuList = m.createMainMenu()
				m.textInput.SetValue("")
				return m, nil
			case stateBrowse:
				// Go back to parent directory or main menu
				if m.currentDir == "/" || m.currentDir == "" {
					m.state = stateMainMenu
					m.menuList = m.createMainMenu()
					return m, nil
				}
				// Navigate to parent directory
				parent := "/"
				if idx := strings.LastIndex(m.currentDir, "/"); idx > 0 {
					parent = m.currentDir[:idx]
				}
				m.currentDir = parent
				m.state = stateLoadingBrowse
				return m, tea.Batch(m.spinner.Tick, m.doListDir(parent))
			case stateCreateNote:
				// Go back to main menu
				m.state = stateMainMenu
				m.menuList = m.createMainMenu()
				return m, nil
			case stateProjectSettings:
				// Go back to main menu
				m.state = stateMainMenu
				m.menuList = m.createMainMenu()
				return m, nil
			case stateConfirmDelete:
				// Cancel note delete
				m.state = stateNote
				return m, nil
			case stateConfirmDeleteProject:
				// Cancel project delete
				m.state = stateProjectSettings
				return m, nil
			case stateMCPServer:
				// Go back to main menu
				m.state = stateMainMenu
				m.menuList = m.createMainMenu()
				return m, nil
			case stateEditNote:
				// Cancel editing, go back to note view
				m.state = stateNote
				return m, nil
			case stateNoteInfo:
				// Go back to results from info view
				m.state = stateResults
				return m, nil
			case stateNote:
				// Go back to previous state (results, recent, or browse)
				if m.prevState != 0 {
					m.state = m.prevState
				} else {
					m.state = stateResults // fallback
				}
				return m, nil
			}
		case "e":
			// Edit note when viewing
			if m.state == stateNote {
				m.initTextarea()
				m.state = stateEditNote
				return m, textarea.Blink
			}
		case "ctrl+s":
			// Save note when editing
			if m.state == stateEditNote {
				content := m.textarea.Value()
				m.state = stateSavingNote
				return m, tea.Batch(m.spinner.Tick, m.doSaveNote(m.noteEntity, content))
			}
		case "d":
			// Delete note when viewing
			if m.state == stateNote {
				m.state = stateConfirmDelete
				m.confirmYes = false // Default to "No" for safety
				return m, nil
			}
			// Delete project from settings
			if m.state == stateProjectSettings {
				m.state = stateConfirmDeleteProject
				m.confirmYes = false // Default to "No" for safety
				return m, nil
			}
		case "y":
			// Quick confirm with 'y' key
			if m.state == stateConfirmDelete {
				m.state = stateDeletingNote
				return m, tea.Batch(m.spinner.Tick, m.doDeleteNote(m.noteEntity))
			}
			if m.state == stateConfirmDeleteProject {
				m.state = stateDeletingProject
				return m, tea.Batch(m.spinner.Tick, m.doDeleteProject(m.project))
			}
		case "n":
			// Quick cancel with 'n' key
			if m.state == stateConfirmDelete {
				m.state = stateNote
				return m, nil
			}
			if m.state == stateConfirmDeleteProject {
				m.state = stateProjectSettings
				return m, nil
			}
		case "left", "h":
			// Navigate confirm buttons
			if m.state == stateConfirmDelete || m.state == stateConfirmDeleteProject {
				m.confirmYes = true
				return m, nil
			}
		case "right", "l":
			// Navigate confirm buttons
			if m.state == stateConfirmDelete || m.state == stateConfirmDeleteProject {
				m.confirmYes = false
				return m, nil
			}
		case "i":
			// Show note info/connections when viewing
			if m.state == stateNote {
				m.state = stateLoadingNoteInfo
				return m, tea.Batch(m.spinner.Tick, m.doFetchNoteInfo(m.noteEntity))
			}
			// Return to note view from info
			if m.state == stateNoteInfo {
				m.state = stateNote
				return m, nil
			}
		case "enter":
			// Handle confirm delete selection
			if m.state == stateConfirmDelete {
				if m.confirmYes {
					m.state = stateDeletingNote
					return m, tea.Batch(m.spinner.Tick, m.doDeleteNote(m.noteEntity))
				} else {
					m.state = stateNote
					return m, nil
				}
			}
			if m.state == stateConfirmDeleteProject {
				if m.confirmYes {
					m.state = stateDeletingProject
					return m, tea.Batch(m.spinner.Tick, m.doDeleteProject(m.project))
				} else {
					m.state = stateProjectSettings
					return m, nil
				}
			}
			// Handle project selection
			if m.state == stateSelectProject {
				selected := m.projectList.SelectedItem()
				if selected != nil {
					selectedName := selected.(projectItem).name
					if selectedName == createProject {
						m.initProjectForm()
						m.state = stateCreateProject
						return m, textinput.Blink
					}
					m.project = selectedName
					m.state = stateMainMenu
					m.menuList = m.createMainMenu()
					return m, nil
				}
			}
			// Handle main menu selection
			if m.state == stateMainMenu {
				selected := m.menuList.SelectedItem()
				if selected != nil {
					switch selected.(menuItem).name {
					case menuSearch:
						m.state = stateSearch
						m.textInput.Focus()
						return m, textinput.Blink
					case menuRecent:
						m.state = stateLoadingRecent
						return m, tea.Batch(m.spinner.Tick, m.doFetchRecent())
					case menuBrowse:
						m.currentDir = "/"
						m.state = stateLoadingBrowse
						return m, tea.Batch(m.spinner.Tick, m.doListDir("/"))
					case menuWrite:
						m.initNoteForm()
						m.state = stateCreateNote
						return m, textinput.Blink
					case menuProject:
						m.state = stateProjectSettings
						return m, nil
					case menuMCP:
						m.state = stateMCPServer
						return m, m.doStartMCPServer()
					}
				}
			}
			// Handle table row selection (check this BEFORE search)
			if m.state == stateResults {
				selected := m.table.SelectedRow()
				if len(selected) > 0 {
					entity := selected[3] // Entity column
					m.noteTitle = entity
					m.prevState = stateResults
					m.state = stateLoadingNote

					// Create viewport with border immediately
					headerHeight := 14 // badge(4) + search(5) + title(3) + spacing
					footerHeight := 3
					contentHeight := m.height - headerHeight - footerHeight
					m.viewport = viewport.New(m.width-8, contentHeight)
					m.viewport.Style = lipgloss.NewStyle().
						BorderStyle(lipgloss.RoundedBorder()).
						BorderForeground(primaryColor).
						PaddingRight(1)
					m.viewport.SetContent("") // Empty content while loading

					return m, tea.Batch(m.spinner.Tick, m.doReadNote(entity))
				}
			}
			// Handle recent table row selection
			if m.state == stateRecent {
				selected := m.table.SelectedRow()
				if len(selected) > 0 {
					entity := selected[2]     // Entity column in recent table
					m.noteTitle = selected[0] // Title column
					m.prevState = stateRecent
					m.state = stateLoadingNote

					// Create viewport with border immediately
					headerHeight := 14
					footerHeight := 3
					contentHeight := m.height - headerHeight - footerHeight
					m.viewport = viewport.New(m.width-8, contentHeight)
					m.viewport.Style = lipgloss.NewStyle().
						BorderStyle(lipgloss.RoundedBorder()).
						BorderForeground(primaryColor).
						PaddingRight(1)
					m.viewport.SetContent("")

					return m, tea.Batch(m.spinner.Tick, m.doReadNote(entity))
				}
			}
			// Handle browse table row selection
			if m.state == stateBrowse {
				selected := m.table.SelectedRow()
				if len(selected) > 0 {
					itemType := selected[0] // Type column (folder or file icon)
					path := selected[3]     // Path column (after Size column)

					if itemType == "folder" {
						// Navigate into directory
						m.currentDir = path
						m.state = stateLoadingBrowse
						return m, tea.Batch(m.spinner.Tick, m.doListDir(path))
					} else {
						// Open file - path is like "specs/roadmap.md", convert to entity
						entity := strings.TrimSuffix(path, ".md")
						m.noteTitle = selected[1] // Name column
						m.prevState = stateBrowse
						m.state = stateLoadingNote

						headerHeight := 14
						footerHeight := 3
						contentHeight := m.height - headerHeight - footerHeight
						m.viewport = viewport.New(m.width-8, contentHeight)
						m.viewport.Style = lipgloss.NewStyle().
							BorderStyle(lipgloss.RoundedBorder()).
							BorderForeground(primaryColor).
							PaddingRight(1)
						m.viewport.SetContent("")

						return m, tea.Batch(m.spinner.Tick, m.doReadNote(entity))
					}
				}
			}
			// Handle search (from search state or from note view with input focused)
			if (m.state == stateSearch || (m.state == stateNote && m.noteFocusInput)) && m.textInput.Value() != "" {
				m.query = m.textInput.Value()
				m.state = stateLoading
				m.noteFocusInput = false // Reset focus state
				m.noteContent = ""       // Clear loaded note
				return m, tea.Batch(m.spinner.Tick, m.doSearch())
			}
			// Handle create project form submit
			if m.state == stateCreateProject {
				if m.projectFormFocused == len(m.projectFormInputs)-1 {
					// On last field, submit the form
					name := m.projectFormInputs[projectFieldName].Value()
					path := m.projectFormInputs[projectFieldPath].Value()
					if name != "" && path != "" {
						m.state = stateLoading
						return m, tea.Batch(m.spinner.Tick, m.doCreateProject(name, path))
					}
				} else {
					// Move to next field
					m.projectFormInputs[m.projectFormFocused].Blur()
					m.projectFormFocused++
					m.projectFormInputs[m.projectFormFocused].Focus()
					return m, textinput.Blink
				}
			}
			// Handle create note form submit
			if m.state == stateCreateNote {
				if m.noteFormFocused == len(m.noteFormInputs)-1 {
					// On last field, submit the form
					title := m.noteFormInputs[noteFieldTitle].Value()
					folder := m.noteFormInputs[noteFieldFolder].Value()
					if title != "" {
						if folder == "" {
							folder = "notes"
						}
						m.state = stateLoading
						return m, tea.Batch(m.spinner.Tick, m.doCreateNote(title, folder))
					}
				} else {
					// Move to next field
					m.noteFormInputs[m.noteFormFocused].Blur()
					m.noteFormFocused++
					m.noteFormInputs[m.noteFormFocused].Focus()
					return m, textinput.Blink
				}
			}
		case "tab", "shift+tab":
			// Toggle focus between search input and viewport when viewing note
			if m.state == stateNote {
				m.noteFocusInput = !m.noteFocusInput
				if m.noteFocusInput {
					m.textInput.Focus()
				} else {
					m.textInput.Blur()
				}
				return m, nil
			}
			// Toggle confirm selection
			if m.state == stateConfirmDelete || m.state == stateConfirmDeleteProject {
				m.confirmYes = !m.confirmYes
				return m, nil
			}
			// Handle form field navigation
			if m.state == stateCreateProject {
				if msg.String() == "tab" {
					m.projectFormInputs[m.projectFormFocused].Blur()
					m.projectFormFocused = (m.projectFormFocused + 1) % len(m.projectFormInputs)
					m.projectFormInputs[m.projectFormFocused].Focus()
				} else {
					m.projectFormInputs[m.projectFormFocused].Blur()
					m.projectFormFocused--
					if m.projectFormFocused < 0 {
						m.projectFormFocused = len(m.projectFormInputs) - 1
					}
					m.projectFormInputs[m.projectFormFocused].Focus()
				}
				return m, textinput.Blink
			}
			if m.state == stateCreateNote {
				if msg.String() == "tab" {
					m.noteFormInputs[m.noteFormFocused].Blur()
					m.noteFormFocused = (m.noteFormFocused + 1) % len(m.noteFormInputs)
					m.noteFormInputs[m.noteFormFocused].Focus()
				} else {
					m.noteFormInputs[m.noteFormFocused].Blur()
					m.noteFormFocused--
					if m.noteFormFocused < 0 {
						m.noteFormFocused = len(m.noteFormInputs) - 1
					}
					m.noteFormInputs[m.noteFormFocused].Focus()
				}
				return m, textinput.Blink
			}
		}

	case tea.WindowSizeMsg:
		m.width = msg.Width
		m.height = msg.Height

		footerHeight := 3

		// Update list dimensions when in relevant states
		if m.state == stateSelectProject && len(m.projects) > 0 {
			listHeight := msg.Height - 10
			if listHeight < 5 {
				listHeight = 5
			}
			m.projectList.SetSize(msg.Width-4, listHeight)
		}
		if m.state == stateMainMenu {
			listHeight := msg.Height - 10
			if listHeight < 5 {
				listHeight = 5
			}
			m.menuList.SetSize(msg.Width-4, listHeight)
		}

		// Recreate results table with new dimensions
		if m.state == stateResults && len(m.results) > 0 {
			tableHeaderHeight := 11 // badge(4) + search(5) + spacing
			tableContentHeight := msg.Height - tableHeaderHeight - footerHeight
			if tableContentHeight < 5 {
				tableContentHeight = 5
			}
			m.table = m.createTable(tableContentHeight)
		}

		// Recreate browse table with new dimensions
		if m.state == stateBrowse && len(m.dirItems) > 0 {
			tableHeaderHeight := 11
			tableContentHeight := msg.Height - tableHeaderHeight - footerHeight
			if tableContentHeight < 5 {
				tableContentHeight = 5
			}
			m.table = m.createBrowseTable(tableContentHeight)
		}

		// Update viewport and re-render note content if viewing a note
		if m.state == stateNote || m.state == stateLoadingNote {
			headerHeight := 14 // badge(4) + search(5) + title(3) + spacing
			contentHeight := msg.Height - headerHeight - footerHeight
			if contentHeight < 5 {
				contentHeight = 5
			}
			m.viewport = viewport.New(msg.Width-4, contentHeight)
			m.viewport.Style = lipgloss.NewStyle().
				BorderStyle(lipgloss.RoundedBorder()).
				BorderForeground(primaryColor).
				PaddingRight(1)

			if m.state == stateNote && m.noteContent != "" {
				renderer, _ := glamour.NewTermRenderer(
					glamour.WithStylePath("dark"),
					glamour.WithWordWrap(msg.Width-14),
				)
				rendered, _ := renderer.Render(m.noteContent)
				m.viewport.SetContent(rendered)
			}
		}

	case spinner.TickMsg:
		if m.state == stateLoading || m.state == stateLoadingNote || m.state == stateLoadingRecent || m.state == stateLoadingBrowse || m.state == stateSavingNote || m.state == stateDeletingNote || m.state == stateLoadingNoteInfo || m.state == stateDeletingProject || m.projectsLoading {
			m.spinner, cmd = m.spinner.Update(msg)
			return m, cmd
		}

	case projectsMsg:
		m.projectsLoading = false
		if msg.err != nil {
			m.err = msg.err
			// Keep the create option available even on error
			return m, nil
		}
		m.projects = msg.projects

		// Sort projects alphabetically (case-insensitive)
		sortedProjects := make([]string, len(m.projects))
		copy(sortedProjects, m.projects)
		sort.Slice(sortedProjects, func(i, j int) bool {
			return strings.ToLower(sortedProjects[i]) < strings.ToLower(sortedProjects[j])
		})

		// Build items with create option FIRST, then sorted projects
		items := make([]list.Item, len(sortedProjects)+1)
		items[0] = projectItem{name: createProject, desc: "create a new memory project", alwaysMatch: true}
		for i, p := range sortedProjects {
			items[i+1] = projectItem{name: p, desc: "memory project"}
		}

		// Update the existing list with new items (keeps delegate settings)
		m.projectList.SetItems(items)

		// Set list size to fit within screen (leave room for header badge + footer)
		listHeight := m.height - 10
		if listHeight < 5 {
			listHeight = 5
		}
		m.projectList.SetSize(m.width-4, listHeight)

		// Status bar is already enabled, just ensure styling
		m.projectList.Styles.StatusBar = lipgloss.NewStyle().Faint(true).PaddingLeft(2).MarginBottom(1)
		return m, nil

	case searchResultsMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateSearch
			return m, nil
		}
		m.results = msg.response.Results
		if len(m.results) == 0 {
			m.state = stateSearch
			return m, nil
		}
		m.state = stateResults
		headerHeight := 11 // badge(4) + search(5) + spacing
		footerHeight := 3
		contentHeight := m.height - headerHeight - footerHeight
		m.table = m.createTable(contentHeight)
		return m, nil

	case recentResultsMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateMainMenu
			m.menuList = m.createMainMenu()
			return m, nil
		}
		// Check if we have raw markdown text (JSON parsing failed)
		if msg.rawText != "" {
			m.recentRawText = msg.rawText
			m.recentResults = nil
			m.state = stateRecent
			// Setup viewport to display raw text
			headerHeight := 9
			footerHeight := 3
			contentHeight := m.height - headerHeight - footerHeight
			m.viewport = viewport.New(m.width-4, contentHeight)
			m.viewport.SetContent(msg.rawText)
			return m, nil
		}
		m.recentRawText = ""
		m.recentResults = msg.response.Results
		if len(m.recentResults) == 0 {
			m.state = stateMainMenu
			m.menuList = m.createMainMenu()
			return m, nil
		}
		m.state = stateRecent
		headerHeight := 9 // badge(4) + title(3) + spacing
		footerHeight := 3
		contentHeight := m.height - headerHeight - footerHeight
		m.table = m.createRecentTable(contentHeight)
		return m, nil

	case dirResultsMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateMainMenu
			m.menuList = m.createMainMenu()
			return m, nil
		}
		// Check if we have raw markdown text (JSON parsing failed)
		if msg.rawText != "" {
			m.dirRawText = msg.rawText
			m.dirItems = nil
			m.state = stateBrowse
			// Setup viewport to display raw text
			headerHeight := 9
			footerHeight := 3
			contentHeight := m.height - headerHeight - footerHeight
			m.viewport = viewport.New(m.width-4, contentHeight)
			m.viewport.SetContent(msg.rawText)
			return m, nil
		}
		m.dirRawText = ""
		m.dirItems = msg.response.Items
		m.currentDir = msg.response.Directory
		m.state = stateBrowse
		headerHeight := 9 // badge(4) + title(3) + spacing
		footerHeight := 3
		contentHeight := m.height - headerHeight - footerHeight
		m.table = m.createBrowseTable(contentHeight)
		return m, nil

	case createProjectMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateCreateProject
			return m, nil
		}
		// Project created successfully, select it and go to main menu
		m.project = msg.name
		m.projects = append(m.projects, msg.name)
		m.state = stateMainMenu
		m.menuList = m.createMainMenu()
		return m, nil

	case createNoteMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateCreateNote
			return m, nil
		}
		// Note created successfully, go back to main menu
		m.state = stateMainMenu
		m.menuList = m.createMainMenu()
		return m, nil

	case noteContentMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateResults
			return m, nil
		}
		m.noteContent = msg.content
		m.noteEntity = msg.title // Store entity for editing
		// Extract folder from entity (e.g., "specs/roadmap" -> "specs")
		if idx := strings.LastIndex(msg.title, "/"); idx > 0 {
			m.noteFolder = msg.title[:idx]
		} else {
			m.noteFolder = "notes"
		}
		m.state = stateNote

		// Create viewport with rounded border
		headerHeight := 14 // badge(4) + search(5) + title(3) + spacing
		footerHeight := 3
		contentHeight := m.height - headerHeight - footerHeight
		m.viewport = viewport.New(m.width-8, contentHeight)
		m.viewport.Style = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(primaryColor).
			PaddingRight(1)

		// Use pre-rendered content from background goroutine
		m.viewport.SetContent(msg.rendered)
		return m, nil

	case saveNoteMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateEditNote
			return m, nil
		}
		// Note saved successfully, update content and return to view
		m.noteContent = m.textarea.Value()
		m.state = stateNote

		// Re-render the viewport with updated content
		headerHeight := 14
		footerHeight := 3
		contentHeight := m.height - headerHeight - footerHeight
		m.viewport = viewport.New(m.width-8, contentHeight)
		m.viewport.Style = lipgloss.NewStyle().
			BorderStyle(lipgloss.RoundedBorder()).
			BorderForeground(primaryColor).
			PaddingRight(1)

		renderer, _ := glamour.NewTermRenderer(
			glamour.WithStylePath("dark"),
			glamour.WithWordWrap(m.width-14),
		)
		rendered, _ := renderer.Render(m.noteContent)
		m.viewport.SetContent(rendered)
		return m, nil

	case deleteNoteMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateNote
			return m, nil
		}
		// Note deleted successfully, go back to main menu
		m.state = stateMainMenu
		m.menuList = m.createMainMenu()
		return m, nil

	case noteInfoMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateNote
			return m, nil
		}
		m.noteInfo = msg.response
		m.state = stateNoteInfo
		return m, nil

	case deleteProjectMsg:
		if msg.err != nil {
			m.err = msg.err
			m.state = stateProjectSettings
			return m, nil
		}
		// Project deleted, go back to project selection
		m.project = ""
		m.state = stateSelectProject
		return m, m.fetchProjects()

	case mcpServerMsg:
		if msg.err != nil {
			m.err = msg.err
		}
		// MCP server started - stay in this state showing info
		return m, nil
	}

	// Update active components based on state
	if m.state == stateSelectProject {
		m.projectList, cmd = m.projectList.Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.state == stateMainMenu {
		m.menuList, cmd = m.menuList.Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.state == stateSearch || m.state == stateLoading || m.state == stateResults || m.state == stateLoadingNote {
		m.textInput, cmd = m.textInput.Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.state == stateCreateProject && len(m.projectFormInputs) > 0 {
		m.projectFormInputs[m.projectFormFocused], cmd = m.projectFormInputs[m.projectFormFocused].Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.state == stateCreateNote && len(m.noteFormInputs) > 0 {
		m.noteFormInputs[m.noteFormFocused], cmd = m.noteFormInputs[m.noteFormFocused].Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.state == stateResults || m.state == stateRecent || m.state == stateBrowse {
		m.table, cmd = m.table.Update(msg)
		cmds = append(cmds, cmd)
	}

	if m.state == stateNote {
		if m.noteFocusInput {
			m.textInput, cmd = m.textInput.Update(msg)
			cmds = append(cmds, cmd)
		} else {
			m.viewport, cmd = m.viewport.Update(msg)
			cmds = append(cmds, cmd)
		}
	}

	if m.state == stateEditNote {
		m.textarea, cmd = m.textarea.Update(msg)
		cmds = append(cmds, cmd)
	}

	return m, tea.Batch(cmds...)
}

func (m model) View() string {
	indent := "  "              // Consistent indent for all elements
	contentWidth := m.width - 4 // Account for left and right indent

	var b strings.Builder

	// === HEADER (always shown) ===
	b.WriteString("\n")
	b.WriteString(m.renderBadge())
	b.WriteString("\n")

	// === CONTENT (conditional) ===
	switch m.state {
	case stateSelectProject:
		// Show project list (create option is always visible immediately)
		b.WriteString("\n")

		// Get filter value from project list
		filterValue := m.projectList.FilterInput.Value()
		if m.projectList.FilterState() == list.Filtering {
			filterValue = m.projectList.FilterInput.View()
		}
		b.WriteString(m.renderFilterBadge("Projects", filterValue, contentWidth))
		b.WriteString("\n\n")

		listLines := strings.Split(m.projectList.View(), "\n")
		// Trim trailing empty lines from the list view
		for len(listLines) > 0 && strings.TrimSpace(listLines[len(listLines)-1]) == "" {
			listLines = listLines[:len(listLines)-1]
		}
		for _, line := range listLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}
		// Show spinner directly after list items while loading other projects
		if m.projectsLoading {
			b.WriteString("\n")
			b.WriteString(indent)
			b.WriteString(fmt.Sprintf("%s Loading projects...", m.spinner.View()))
		}

	case stateCreateProject:
		// Show create project form
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render("Create New Project"))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Project name"))
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(m.projectFormInputs[projectFieldName].View())
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Project path"))
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(m.projectFormInputs[projectFieldPath].View())
		b.WriteString("\n")

	case stateMainMenu:
		// Show main menu
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render(fmt.Sprintf("  Project: %s", m.project)))
		b.WriteString("\n\n")
		listLines := strings.Split(m.menuList.View(), "\n")
		for _, line := range listLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}

	case stateCreateNote:
		// Show create note form
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render("Create New Note"))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Note title"))
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(m.noteFormInputs[noteFieldTitle].View())
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Folder"))
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(m.noteFormInputs[noteFieldFolder].View())
		b.WriteString("\n")

	case stateLoadingRecent:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(" Recent Activity"))
		b.WriteString("\n\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Loading recent notes...", m.spinner.View()))

	case stateRecent:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render("Recent Activity"))
		b.WriteString("\n\n\n")
		// Check if we have raw text fallback or structured data
		if m.recentRawText != "" {
			// Display raw markdown in viewport
			viewportLines := strings.Split(m.viewport.View(), "\n")
			for _, line := range viewportLines {
				b.WriteString(indent)
				b.WriteString(line)
				b.WriteString("\n")
			}
		} else {
			// Table with consistent margins
			tableLines := strings.Split(m.table.View(), "\n")
			for _, line := range tableLines {
				b.WriteString(indent)
				b.WriteString(line)
				b.WriteString("\n")
			}
		}
	case stateLoadingBrowse:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Browse: %s", m.currentDir)))
		b.WriteString("\n\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Loading directory...", m.spinner.View()))

	case stateBrowse:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf("Browse: %s", m.currentDir)))
		b.WriteString("\n\n\n")
		// Check if we have raw text fallback or structured data
		if m.dirRawText != "" {
			// Display raw markdown in viewport
			viewportLines := strings.Split(m.viewport.View(), "\n")
			for _, line := range viewportLines {
				b.WriteString(indent)
				b.WriteString(line)
				b.WriteString("\n")
			}
		} else {
			// Table with consistent margins
			tableLines := strings.Split(m.table.View(), "\n")
			for _, line := range tableLines {
				b.WriteString(indent)
				b.WriteString(line)
				b.WriteString("\n")
			}
		}

	case stateSearch:
		b.WriteString("\n")
		b.WriteString(m.renderFilterBadge("Notes", m.textInput.View(), contentWidth))
		b.WriteString("\n\n")
		if m.err != nil {
			b.WriteString(indent)
			b.WriteString(lipgloss.NewStyle().Foreground(lipgloss.Color("196")).Render(m.err.Error()))
			b.WriteString("\n")
		}

	case stateLoading:
		b.WriteString("\n")
		b.WriteString(m.renderFilterBadge("Notes", m.textInput.View(), contentWidth))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Searching...", m.spinner.View()))

	case stateLoadingNote:
		b.WriteString("\n")
		b.WriteString(m.renderFilterBadge("Notes", m.textInput.View(), contentWidth))
		b.WriteString("\n\n")
		// Note title with spinner
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s %s", m.spinner.View(), titleStyle.Render(m.noteTitle)))
		b.WriteString("\n\n")
		// Empty viewport with border
		viewportLines := strings.Split(m.viewport.View(), "\n")
		for _, line := range viewportLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}

	case stateResults:
		b.WriteString("\n")
		b.WriteString(m.renderFilterBadge("Notes", m.textInput.View(), contentWidth))
		b.WriteString("\n\n")
		// Table with consistent margins
		tableLines := strings.Split(m.table.View(), "\n")
		for _, line := range tableLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}

	case stateNote:
		b.WriteString("\n")
		b.WriteString(m.renderFilterBadge("Notes", m.textInput.View(), contentWidth))
		b.WriteString("\n\n")
		// Note title
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf("[note] %s", m.noteTitle)))
		b.WriteString("\n\n")
		// Viewport with consistent margins
		viewportLines := strings.Split(m.viewport.View(), "\n")
		for _, line := range viewportLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}

	case stateEditNote:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Editing: %s", m.noteTitle)))
		b.WriteString("\n\n")
		// Textarea with consistent margins
		textareaLines := strings.Split(m.textarea.View(), "\n")
		for _, line := range textareaLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}

	case stateSavingNote:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Editing: %s", m.noteTitle)))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Saving...", m.spinner.View()))

	case stateConfirmDelete:
		b.WriteString("\n")
		// Render gum-style confirm dialog (no title needed)
		confirmLines := strings.Split(m.renderConfirmDialog("Are you sure you want to delete ", m.noteTitle, "?", m.confirmYes), "\n")
		for _, line := range confirmLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}

	case stateDeletingNote:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Delete: %s", m.noteTitle)))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Deleting...", m.spinner.View()))

	case stateLoadingNoteInfo:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Info: %s", m.noteTitle)))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Loading connections...", m.spinner.View()))

	case stateNoteInfo:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Info: %s", m.noteTitle)))
		b.WriteString("\n\n")

		// Entity/Path info
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Entity: "))
		b.WriteString(m.noteEntity)
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Folder: "))
		b.WriteString(m.noteFolder)
		b.WriteString("\n\n")

		// Connections section
		if len(m.noteInfo.Connections) > 0 {
			b.WriteString(indent)
			b.WriteString(titleStyle.Render("Connections"))
			b.WriteString("\n")
			for _, conn := range m.noteInfo.Connections {
				b.WriteString(indent)
				b.WriteString(fmt.Sprintf("  -> %s [[%s]]\n", conn.Type, conn.Target))
			}
			b.WriteString("\n")
		} else {
			b.WriteString(indent)
			b.WriteString(helpStyle.Render("No connections found"))
			b.WriteString("\n\n")
		}

		// Observations section
		if len(m.noteInfo.Observations) > 0 {
			b.WriteString(indent)
			b.WriteString(titleStyle.Render("Observations"))
			b.WriteString("\n")
			for _, obs := range m.noteInfo.Observations {
				b.WriteString(indent)
				content := obs.Content
				if len(content) > 60 {
					content = content[:57] + "..."
				}
				b.WriteString(fmt.Sprintf("  [%s] %s\n", obs.Category, content))
			}
		}

	case stateProjectSettings:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(" Project Settings"))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render(" Project: "))
		b.WriteString(lipgloss.NewStyle().Bold(true).Render(m.project))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render(" Actions:"))
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString("  d - Delete this project")
		b.WriteString("\n")

	case stateConfirmDeleteProject:
		b.WriteString("\n")
		// Render gum-style confirm dialog (no title needed)
		confirmLines := strings.Split(m.renderConfirmDialog("Are you sure you want to delete project ", m.project, "?", m.confirmYes), "\n")
		for _, line := range confirmLines {
			b.WriteString(indent)
			b.WriteString(line)
			b.WriteString("\n")
		}
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("This will remove the project from memory but NOT delete your files."))

	case stateDeletingProject:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render(fmt.Sprintf(" Delete Project: %s", m.project)))
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(fmt.Sprintf("%s Deleting project...", m.spinner.View()))

	case stateMCPServer:
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(titleStyle.Render("[mcp] MCP Server"))
		b.WriteString("\n\n")
		if m.err != nil {
			b.WriteString(indent)
			errStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#ff6b6b"))
			b.WriteString(errStyle.Render(fmt.Sprintf("Error: %v", m.err)))
			b.WriteString("\n\n")
		} else {
			b.WriteString(indent)
			successStyle := lipgloss.NewStyle().Foreground(lipgloss.Color("#50fa7b"))
			b.WriteString(successStyle.Render("[ok] MCP server started"))
			b.WriteString("\n\n")
		}
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Project: "))
		b.WriteString(m.project)
		b.WriteString("\n\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("The MCP server is now syncing your notes."))
		b.WriteString("\n")
		b.WriteString(indent)
		b.WriteString(helpStyle.Render("Connect Claude Desktop or another MCP client to use it."))
	}

	// === FOOTER (always at bottom) ===
	var footer string
	switch m.state {
	case stateSelectProject:
		footer = renderHelp("up/down", "navigate", "/", "filter", "enter", "select", "q", "quit")
	case stateCreateProject:
		footer = renderHelp("tab", "next field", "enter", "create", "esc", "cancel")
	case stateMainMenu:
		footer = renderHelp("up/down", "navigate", "enter", "select", "esc", "back")
	case stateCreateNote:
		footer = renderHelp("tab", "next field", "enter", "create", "esc", "cancel")
	case stateSearch:
		footer = renderHelp("enter", "search", "esc", "back")
	case stateLoading:
		footer = helpDescStyle.Render("searching...")
	case stateLoadingRecent:
		footer = helpDescStyle.Render("loading...")
	case stateLoadingNote:
		footer = helpDescStyle.Render("loading...")
	case stateRecent:
		footer = renderHelp("up/down", "navigate", "enter", "open", "esc", "back")
	case stateLoadingBrowse:
		footer = helpDescStyle.Render("loading...")
	case stateBrowse:
		footer = renderHelp("up/down", "navigate", "enter", "open", "esc", "back")
	case stateResults:
		footer = renderHelp("up/down", "navigate", "enter", "open", "esc", "back")
	case stateNote:
		footer = renderHelp("tab", "focus", "up/down", "scroll", "e", "edit", "d", "delete", "i", "info", "esc", "back")
	case stateEditNote:
		footer = renderHelp("ctrl+s", "save", "esc", "cancel")
	case stateSavingNote:
		footer = helpDescStyle.Render("saving...")
	case stateConfirmDelete:
		footer = renderHelp("left/right", "select", "enter", "confirm", "y/n", "quick select", "esc", "back")
	case stateDeletingNote:
		footer = helpDescStyle.Render("deleting...")
	case stateLoadingNoteInfo:
		footer = helpDescStyle.Render("loading...")
	case stateNoteInfo:
		footer = renderHelp("i", "back to note", "esc", "back to results")
	case stateProjectSettings:
		footer = renderHelp("d", "delete project", "esc", "back")
	case stateConfirmDeleteProject:
		footer = renderHelp("left/right", "select", "enter", "confirm", "y/n", "quick select", "esc", "back")
	case stateDeletingProject:
		footer = helpDescStyle.Render("deleting...")
	case stateMCPServer:
		footer = renderHelp("esc", "back to menu")
	}

	// Position footer at bottom
	contentHeight := lipgloss.Height(b.String())
	padding := m.height - contentHeight - 3
	if padding > 0 {
		b.WriteString(strings.Repeat("\n", padding))
	}
	b.WriteString("\n")   // Extra line before help
	b.WriteString("    ") // 3 spaces to align with badge
	b.WriteString(footer)

	// Ensure content doesn't exceed width
	_ = contentWidth

	return b.String()
}

func renderHelp(items ...string) string {
	// items are pairs of key, description
	var parts []string
	for i := 0; i < len(items)-1; i += 2 {
		key := helpKeyStyle.Render(items[i])
		desc := helpDescStyle.Render(items[i+1])
		parts = append(parts, key+" "+desc)
	}
	sep := helpSepStyle.Render(" | ")
	return strings.Join(parts, sep)
}

// formatSize formats bytes into human-readable size
func formatSize(bytes int64) string {
	const unit = 1024
	if bytes < unit {
		return fmt.Sprintf("%dB", bytes)
	}
	div, exp := int64(unit), 0
	for n := bytes / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f%c", float64(bytes)/float64(div), "KMGTPE"[exp])
}

func (m model) renderBadge() string {
	// Match the memory CLI badge exactly:
	//   [bar top border]
	//  MEMORY   0.1.0 |
	//   [bar bottom border]

	topLine := "   " + lipgloss.NewStyle().Bold(true).Foreground(primaryColor).Render("===========") +
		lipgloss.NewStyle().Foreground(primaryColor).Render("-------+")

	// Middle: "BRAIN " on blue bg + space + "0.1.0 |" in blue
	middleLine := "   " + badgeStyle.Render("[brain] ") + " " + badgeVersionStyle.Render("0.1.0 |")

	bottomLine := "   " + lipgloss.NewStyle().Bold(true).Foreground(primaryColor).Render("===========---------+")

	return topLine + "\n" + middleLine + "\n" + bottomLine
}

// renderFilterBadge renders a badge-style filter input box
// badgeLabel: text to show in the badge (e.g., "Projects", "Search")
// inputValue: the current value in the filter/search input
// contentWidth: available width for the component
func (m model) renderFilterBadge(badgeLabel string, inputValue string, contentWidth int) string {
	var b strings.Builder

	// Badge style: blue text, bold
	filterBadgeStyle := lipgloss.NewStyle().
		Foreground(primaryColor).
		Bold(true)

	// Box dimensions
	badgeText := " " + badgeLabel + " "
	badgeWidth := len(badgeText)
	boxWidth := contentWidth - badgeWidth - 6
	if boxWidth < 20 {
		boxWidth = 60
	}

	borderStyle := lipgloss.NewStyle().Foreground(whiteColor)
	promptStyle := lipgloss.NewStyle().Foreground(primaryColor)

	filterContent := promptStyle.Render(">  ") + inputValue

	// Top line: badge top border + box top border
	badgeTopBorder := lipgloss.NewStyle().Foreground(whiteColor).Bold(true).Render("+" + strings.Repeat("-", badgeWidth))
	borderWidth := boxWidth - 2
	if borderWidth < 1 {
		borderWidth = 1
	}
	topBorder := "-" + strings.Repeat("-", borderWidth) + "+"
	b.WriteString("   ")
	b.WriteString(badgeTopBorder)
	b.WriteString(borderStyle.Render(topBorder))
	b.WriteString("\n")

	// Middle line: badge text + box content
	contentPadding := boxWidth - 4 - lipgloss.Width(filterContent)
	if contentPadding < 0 {
		contentPadding = 0
	}
	b.WriteString("   |")
	b.WriteString(filterBadgeStyle.Render(badgeText))
	b.WriteString(borderStyle.Render(""))
	b.WriteString(filterContent)
	b.WriteString(strings.Repeat(" ", contentPadding))
	b.WriteString(borderStyle.Render("   |"))
	b.WriteString("\n")

	// Bottom line: badge bottom border + box bottom border
	badgeBottomBorder := lipgloss.NewStyle().Foreground(whiteColor).Bold(true).Render("+" + strings.Repeat("-", badgeWidth))
	bottomBorder := "-" + strings.Repeat("-", borderWidth) + "+"
	b.WriteString("   ")
	b.WriteString(badgeBottomBorder)
	b.WriteString(borderStyle.Render(bottomBorder))

	return b.String()
}

// renderConfirmDialog renders a gum-style confirm dialog with Yes/No buttons
// promptPrefix: text before the item name (e.g., "Are you sure you want to delete ")
// itemName: the name of the item to delete (rendered in blue bold)
// promptSuffix: text after the item name (e.g., "?")
// yesSelected: whether Yes is currently selected
func (m model) renderConfirmDialog(promptPrefix string, itemName string, promptSuffix string, yesSelected bool) string {
	var b strings.Builder

	// Styles
	promptStyle := lipgloss.NewStyle().
		Foreground(whiteColor)

	itemStyle := lipgloss.NewStyle().
		Foreground(primaryColor).
		Bold(true)

	selectedStyle := lipgloss.NewStyle().
		Background(primaryColor). // Blue background
		Foreground(whiteColor).   // White text
		Padding(0, 3).
		MarginRight(1)

	unselectedStyle := lipgloss.NewStyle().
		Background(whiteColor).            // White background
		Foreground(lipgloss.Color("240")). // Dark gray text
		Padding(0, 3).
		MarginRight(1)

	// Blue prompt indicator
	promptIndicator := lipgloss.NewStyle().Foreground(primaryColor).Render("> ")

	// Prompt with highlighted item name
	b.WriteString(promptIndicator)
	b.WriteString(promptStyle.Render(promptPrefix))
	b.WriteString(itemStyle.Render(itemName))
	b.WriteString(promptStyle.Render(promptSuffix))
	b.WriteString("\n\n")

	// Buttons
	var yesBtn, noBtn string
	if yesSelected {
		yesBtn = selectedStyle.Render("Yes")
		noBtn = unselectedStyle.Render("No")
	} else {
		yesBtn = unselectedStyle.Render("Yes")
		noBtn = selectedStyle.Render("No")
	}

	b.WriteString(lipgloss.JoinHorizontal(lipgloss.Center, yesBtn, noBtn))

	return b.String()
}

func (m *model) createProjectDelegate() list.DefaultDelegate {
	delegate := list.NewDefaultDelegate()
	delegate.SetHeight(2)  // 2 lines per item (title + description)
	delegate.SetSpacing(1) // 1 line spacing between items
	// Selected: blue title, faint blue description, blue cursor line
	delegate.Styles.SelectedTitle = lipgloss.NewStyle().
		Foreground(primaryColor).
		Bold(true).
		BorderLeft(true).
		BorderStyle(lipgloss.ThickBorder()).
		BorderForeground(primaryColor).
		PaddingLeft(1)
	delegate.Styles.SelectedDesc = lipgloss.NewStyle().
		Foreground(primaryColor).
		Faint(true).
		BorderLeft(true).
		BorderStyle(lipgloss.ThickBorder()).
		BorderForeground(primaryColor).
		PaddingLeft(1)
	// Normal: bold white title, faint gray description
	delegate.Styles.NormalTitle = lipgloss.NewStyle().
		Foreground(whiteColor).
		Bold(true).
		PaddingLeft(2)
	delegate.Styles.NormalDesc = lipgloss.NewStyle().
		Faint(true).
		PaddingLeft(2)
	return delegate
}

func (m *model) initProjectListWithCreate() {
	// Start with just the create option visible
	items := []list.Item{
		projectItem{name: createProject, desc: "create a new memory project", alwaysMatch: true},
	}

	delegate := m.createProjectDelegate()

	// Use sensible defaults for dimensions
	listWidth := 80
	listHeight := 20
	if m.width > 0 {
		listWidth = m.width - 4
	}
	if m.height > 0 {
		listHeight = m.height - 10
	}

	m.projectList = list.New(items, delegate, listWidth, listHeight)
	m.projectList.Title = ""
	m.projectList.Styles.Title = lipgloss.NewStyle()
	m.projectList.Styles.StatusBar = lipgloss.NewStyle().Faint(true).PaddingLeft(2).MarginBottom(1)
	m.projectList.Styles.PaginationStyle = lipgloss.NewStyle().PaddingLeft(2)
	m.projectList.Styles.ActivePaginationDot = lipgloss.NewStyle().Foreground(whiteColor).SetString("*")
	m.projectList.Styles.InactivePaginationDot = lipgloss.NewStyle().Foreground(lipgloss.Color("#3C3C3C")).Faint(true).SetString("*")
	m.projectList.Styles.FilterPrompt = lipgloss.NewStyle().Foreground(primaryColor)
	m.projectList.Styles.FilterCursor = lipgloss.NewStyle().Foreground(whiteColor)
	m.projectList.SetShowStatusBar(true)
	m.projectList.SetFilteringEnabled(true)
	m.projectList.SetShowHelp(false)
	m.projectList.SetShowFilter(false) // We render our own custom filter box
	m.projectList.SetShowPagination(true)
	m.projectList.SetShowTitle(false)
	m.projectList.DisableQuitKeybindings()
	m.projectList.FilterInput.PromptStyle = lipgloss.NewStyle().Foreground(whiteColor)
	m.projectList.FilterInput.Prompt = ""
	m.projectList.FilterInput.TextStyle = lipgloss.NewStyle().Foreground(whiteColor)
}

func (m *model) initProjectForm() {
	inputs := make([]textinput.Model, 2)

	// Project name field
	inputs[projectFieldName] = textinput.New()
	inputs[projectFieldName].Placeholder = "my-project"
	inputs[projectFieldName].Focus()
	inputs[projectFieldName].CharLimit = 64
	inputs[projectFieldName].Width = 40
	inputs[projectFieldName].PromptStyle = lipgloss.NewStyle().Foreground(primaryColor)
	inputs[projectFieldName].Prompt = "> "

	// Project path field
	inputs[projectFieldPath] = textinput.New()
	inputs[projectFieldPath].Placeholder = "~/memories/my-project"
	inputs[projectFieldPath].CharLimit = 256
	inputs[projectFieldPath].Width = 40
	inputs[projectFieldPath].PromptStyle = lipgloss.NewStyle().Foreground(primaryColor)
	inputs[projectFieldPath].Prompt = "> "

	m.projectFormInputs = inputs
	m.projectFormFocused = 0
}

func (m *model) initNoteForm() {
	inputs := make([]textinput.Model, 2)

	// Note title field
	inputs[noteFieldTitle] = textinput.New()
	inputs[noteFieldTitle].Placeholder = "My Note Title"
	inputs[noteFieldTitle].Focus()
	inputs[noteFieldTitle].CharLimit = 128
	inputs[noteFieldTitle].Width = 40
	inputs[noteFieldTitle].PromptStyle = lipgloss.NewStyle().Foreground(primaryColor)
	inputs[noteFieldTitle].Prompt = "> "

	// Folder field
	inputs[noteFieldFolder] = textinput.New()
	inputs[noteFieldFolder].Placeholder = "notes"
	inputs[noteFieldFolder].CharLimit = 128
	inputs[noteFieldFolder].Width = 40
	inputs[noteFieldFolder].PromptStyle = lipgloss.NewStyle().Foreground(primaryColor)
	inputs[noteFieldFolder].Prompt = "> "

	m.noteFormInputs = inputs
	m.noteFormFocused = 0
}

func (m *model) initTextarea() {
	ta := textarea.New()
	ta.SetValue(m.noteContent)
	ta.Focus()

	// Size the textarea to fit the screen
	headerHeight := 9 // badge(4) + title(3) + spacing
	footerHeight := 3
	contentHeight := m.height - headerHeight - footerHeight - 2
	ta.SetWidth(m.width - 8)
	ta.SetHeight(contentHeight)

	// Style
	ta.FocusedStyle.CursorLine = lipgloss.NewStyle()
	ta.FocusedStyle.Base = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(primaryColor)
	ta.BlurredStyle.Base = lipgloss.NewStyle().
		BorderStyle(lipgloss.RoundedBorder()).
		BorderForeground(dimColor)

	m.textarea = ta
}

func (m model) createMainMenu() list.Model {
	items := []list.Item{
		menuItem{name: menuSearch, desc: "search across all notes"},
		menuItem{name: menuRecent, desc: "view recently updated notes"},
		menuItem{name: menuBrowse, desc: "browse notes by folder"},
		menuItem{name: menuWrite, desc: "create a new note"},
		menuItem{name: menuProject, desc: "view and manage project settings"},
		menuItem{name: menuMCP, desc: "start the MCP server"},
	}

	delegate := list.NewDefaultDelegate()
	delegate.SetHeight(2)  // 2 lines per item (title + description)
	delegate.SetSpacing(1) // 1 line spacing between items
	// Selected: blue title, faint blue description, blue cursor line
	delegate.Styles.SelectedTitle = lipgloss.NewStyle().
		Foreground(primaryColor).
		Bold(true).
		BorderLeft(true).
		BorderStyle(lipgloss.ThickBorder()).
		BorderForeground(primaryColor).
		PaddingLeft(1)
	delegate.Styles.SelectedDesc = lipgloss.NewStyle().
		Foreground(primaryColor).
		Faint(true).
		BorderLeft(true).
		BorderStyle(lipgloss.ThickBorder()).
		BorderForeground(primaryColor).
		PaddingLeft(1)
	// Normal: bold white title, faint gray description
	delegate.Styles.NormalTitle = lipgloss.NewStyle().
		Foreground(whiteColor).
		Bold(true).
		PaddingLeft(2)
	delegate.Styles.NormalDesc = lipgloss.NewStyle().
		Faint(true).
		PaddingLeft(2)

	menuList := list.New(items, delegate, m.width-4, m.height-10)
	menuList.Title = ""
	menuList.SetShowStatusBar(false)
	menuList.SetFilteringEnabled(false)
	menuList.SetShowHelp(false)
	menuList.SetShowFilter(false)
	menuList.SetShowPagination(false)
	menuList.SetShowTitle(false)
	menuList.DisableQuitKeybindings()

	return menuList
}

func (m model) createBrowseTable(height int) table.Model {
	// Calculate column widths based on terminal width
	totalWidth := m.width - 8 // margins
	typeWidth := 8
	sizeWidth := 8
	pathWidth := 30
	nameWidth := totalWidth - typeWidth - sizeWidth - pathWidth - 8

	if nameWidth < 20 {
		nameWidth = 20
	}

	columns := []table.Column{
		{Title: "", Width: typeWidth}, // Type icon
		{Title: "Name", Width: nameWidth},
		{Title: "Size", Width: sizeWidth},
		{Title: "Path", Width: pathWidth},
	}

	rows := make([]table.Row, len(m.dirItems))
	for i, item := range m.dirItems {
		icon := "file"
		if item.Type == "directory" {
			icon = "folder"
		}
		name := item.Name
		if item.Title != "" {
			name = item.Title
		}
		if len(name) > nameWidth-3 {
			name = name[:nameWidth-6] + "..."
		}
		// Format file size
		size := ""
		if item.Type != "directory" && item.Size > 0 {
			size = formatSize(item.Size)
		}
		rows[i] = table.Row{
			icon,
			name,
			size,
			item.Path,
		}
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(height-2),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(primaryColor).
		BorderBottom(true).
		Bold(true).
		Foreground(primaryColor)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("#ffffff")).
		Background(primaryColor).
		Bold(false)
	t.SetStyles(s)

	return t
}

func (m model) createRecentTable(height int) table.Model {
	// Calculate column widths based on terminal width
	totalWidth := m.width - 8 // margins
	folderWidth := 15
	entityWidth := 35
	titleWidth := totalWidth - folderWidth - entityWidth - 6

	if titleWidth < 20 {
		titleWidth = 20
	}

	columns := []table.Column{
		{Title: "Title", Width: titleWidth},
		{Title: "Folder", Width: folderWidth},
		{Title: "Entity", Width: entityWidth},
	}

	rows := make([]table.Row, len(m.recentResults))
	for i, r := range m.recentResults {
		title := r.Title
		if len(title) > titleWidth-3 {
			title = title[:titleWidth-6] + "..."
		}
		rows[i] = table.Row{
			title,
			r.Folder,
			r.Entity,
		}
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(height-2),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(primaryColor).
		BorderBottom(true).
		Bold(true).
		Foreground(primaryColor)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("#ffffff")).
		Background(primaryColor).
		Bold(false)
	t.SetStyles(s)

	return t
}

func (m model) createTable(height int) table.Model {
	// Calculate column widths based on terminal width
	totalWidth := m.width - 8 // margins
	entityWidth := 30
	typeWidth := 10
	scoreWidth := 7
	titleWidth := totalWidth - entityWidth - typeWidth - scoreWidth - 8

	if titleWidth < 20 {
		titleWidth = 20
	}

	columns := []table.Column{
		{Title: "Title", Width: titleWidth},
		{Title: "Type", Width: typeWidth},
		{Title: "Score", Width: scoreWidth},
		{Title: "Entity", Width: entityWidth},
	}

	rows := make([]table.Row, len(m.results))
	for i, r := range m.results {
		title := r.Title
		if len(title) > titleWidth-3 {
			title = title[:titleWidth-6] + "..."
		}
		rows[i] = table.Row{
			title,
			r.Type,
			fmt.Sprintf("%.2f", r.Score),
			r.Entity,
		}
	}

	t := table.New(
		table.WithColumns(columns),
		table.WithRows(rows),
		table.WithFocused(true),
		table.WithHeight(height-2),
	)

	s := table.DefaultStyles()
	s.Header = s.Header.
		BorderStyle(lipgloss.NormalBorder()).
		BorderForeground(primaryColor).
		BorderBottom(true).
		Bold(true).
		Foreground(primaryColor)
	s.Selected = s.Selected.
		Foreground(lipgloss.Color("#ffffff")).
		Background(primaryColor).
		Bold(false)
	t.SetStyles(s)

	return t
}

// Commands
func (m model) doSearch() tea.Cmd {
	c := m.client
	query := m.query
	project := m.project
	return func() tea.Msg {
		args := map[string]interface{}{
			"query": query,
		}
		if project != "" {
			args["project"] = project
		}

		result, err := c.CallTool("search_notes", args)
		if err != nil {
			return searchResultsMsg{err: fmt.Errorf("search failed: %w", err)}
		}

		var response SearchResponse
		if err := json.Unmarshal([]byte(result.GetText()), &response); err != nil {
			return searchResultsMsg{err: fmt.Errorf("parse failed: %w", err)}
		}

		// Check for error in response (e.g., no project selected)
		if response.Error != "" {
			errMsg := response.Error
			if len(response.Available) > 0 {
				errMsg += fmt.Sprintf(" (available: %s)", strings.Join(response.Available, ", "))
			}
			return searchResultsMsg{err: fmt.Errorf("%s", errMsg)}
		}

		return searchResultsMsg{response: response}
	}
}

func (m model) doReadNote(entity string) tea.Cmd {
	projectPath := m.getProjectPath()
	project := m.project
	width := m.width - 14
	if width < 60 {
		width = 80
	}

	return func() tea.Msg {
		var content string

		// Try direct file read first (much faster than CLI)
		if projectPath != "" {
			filePath := projectPath + "/" + entity + ".md"
			data, err := os.ReadFile(filePath)
			if err == nil {
				content = string(data)
			}
		}

		// Fallback to HTTP if direct read failed
		if content == "" {
			args := map[string]interface{}{
				"identifier": entity,
			}
			if project != "" {
				args["project"] = project
			}

			result, err := m.client.CallTool("read_note", args)
			if err != nil {
				return noteContentMsg{err: fmt.Errorf("read failed: %w", err)}
			}

			// read_note returns markdown content directly
			content = result.GetText()
		}

		// Render markdown in background (keeps spinner alive)
		// Use DarkStyle instead of AutoStyle to avoid terminal color queries
		// that can corrupt text input fields
		renderer, _ := glamour.NewTermRenderer(
			glamour.WithStylePath("dark"),
			glamour.WithWordWrap(width),
		)
		rendered, _ := renderer.Render(content)

		return noteContentMsg{content: content, rendered: rendered, title: entity}
	}
}

func (m model) doCreateProject(name, path string) tea.Cmd {
	return func() tea.Msg {
		// Expand ~ in path
		if strings.HasPrefix(path, "~/") {
			home, _ := os.UserHomeDir()
			path = home + path[1:]
		}

		_, err := m.client.CallTool("create_memory_project", map[string]interface{}{
			"project_name": name,
			"project_path": path,
		})
		if err != nil {
			return createProjectMsg{err: fmt.Errorf("create project failed: %w", err)}
		}

		return createProjectMsg{name: name}
	}
}

func (m model) doCreateNote(title, folder string) tea.Cmd {
	c := m.client
	project := m.project
	return func() tea.Msg {
		args := map[string]interface{}{
			"title":   title,
			"content": "# " + title + "\n\n",
			"folder":  folder,
		}
		if project != "" {
			args["project"] = project
		}

		_, err := c.CallTool("write_note", args)
		if err != nil {
			return createNoteMsg{err: fmt.Errorf("create note failed: %w", err)}
		}

		return createNoteMsg{title: title}
	}
}

func (m model) doSaveNote(entity, content string) tea.Cmd {
	c := m.client
	project := m.project
	return func() tea.Msg {
		// Extract title from entity (e.g., "specs/roadmap" -> "Roadmap")
		title := entity
		if idx := strings.LastIndex(entity, "/"); idx >= 0 {
			title = entity[idx+1:]
		}
		// Convert kebab-case to Title Case
		title = strings.ReplaceAll(title, "-", " ")
		title = strings.Title(title)

		// Extract folder from entity
		folder := "notes"
		if idx := strings.LastIndex(entity, "/"); idx > 0 {
			folder = entity[:idx]
		}

		// Use write_note to save (it overwrites existing)
		args := map[string]interface{}{
			"title":   title,
			"content": content,
			"folder":  folder,
		}
		if project != "" {
			args["project"] = project
		}

		_, err := c.CallTool("write_note", args)
		if err != nil {
			return saveNoteMsg{err: fmt.Errorf("save note failed: %w", err)}
		}

		return saveNoteMsg{title: title}
	}
}

func (m model) doDeleteNote(entity string) tea.Cmd {
	c := m.client
	project := m.project
	return func() tea.Msg {
		args := map[string]interface{}{
			"identifier": entity,
		}
		if project != "" {
			args["project"] = project
		}

		_, err := c.CallTool("delete_note", args)
		if err != nil {
			return deleteNoteMsg{err: fmt.Errorf("delete note failed: %w", err)}
		}

		return deleteNoteMsg{title: entity}
	}
}

func (m model) doFetchNoteInfo(entity string) tea.Cmd {
	c := m.client
	project := m.project
	return func() tea.Msg {
		// Use memory:// URL format for build_context
		url := "memory://" + entity
		args := map[string]interface{}{
			"url": url,
		}
		if project != "" {
			args["project"] = project
		}

		result, err := c.CallTool("build_context", args)
		if err != nil {
			return noteInfoMsg{err: fmt.Errorf("fetch info failed: %w", err)}
		}

		var response ContextResponse
		if err := json.Unmarshal([]byte(result.GetText()), &response); err != nil {
			return noteInfoMsg{err: fmt.Errorf("parse failed: %w", err)}
		}

		return noteInfoMsg{response: response}
	}
}

func (m model) doDeleteProject(name string) tea.Cmd {
	c := m.client
	return func() tea.Msg {
		// Use delete_project via HTTP
		_, err := c.CallTool("delete_project", map[string]interface{}{
			"project_name": name,
		})
		if err != nil {
			return deleteProjectMsg{err: fmt.Errorf("delete project failed: %w", err)}
		}

		return deleteProjectMsg{name: name}
	}
}

func (m model) doStartMCPServer() tea.Cmd {
	c := m.client
	return func() tea.Msg {
		// Server is already running (we connected via HTTP at startup)
		// Just verify it's still responding
		status, err := c.Health()
		if err != nil {
			return mcpServerMsg{err: fmt.Errorf("MCP server check failed: %w", err)}
		}
		if status.Status != "ok" {
			return mcpServerMsg{err: fmt.Errorf("MCP server unhealthy: %s", status.Status)}
		}
		return mcpServerMsg{started: true}
	}
}

func (m model) doFetchRecent() tea.Cmd {
	project := m.project
	return func() tea.Msg {
		// Call basic-memory CLI directly - bypasses MCP schema validation
		// that fails with discriminated unions in GraphContext response
		args := []string{"tool", "build-context", "*", "--timeframe", "7d"}
		if project != "" {
			args = append(args, "--project", project)
		}

		cmd := exec.Command("basic-memory", args...)
		output, err := cmd.Output()
		if err != nil {
			// Include stderr in error message for debugging
			if exitErr, ok := err.(*exec.ExitError); ok {
				return recentResultsMsg{err: fmt.Errorf("CLI error: %s", string(exitErr.Stderr))}
			}
			return recentResultsMsg{err: fmt.Errorf("CLI error: %w", err)}
		}

		// Parse GraphContext response
		var graphResp GraphContextResponse
		if err := json.Unmarshal(output, &graphResp); err != nil {
			// JSON parsing failed - return raw text as fallback
			return recentResultsMsg{rawText: string(output)}
		}

		// Convert GraphContext results to RecentResponse format
		var results []RecentResult
		for _, r := range graphResp.Results {
			// Extract folder from file_path (everything before the last /)
			folder := ""
			if idx := strings.LastIndex(r.PrimaryResult.FilePath, "/"); idx > 0 {
				folder = r.PrimaryResult.FilePath[:idx]
			}
			results = append(results, RecentResult{
				Title:  r.PrimaryResult.Title,
				Folder: folder,
				Entity: r.PrimaryResult.Permalink,
				Type:   r.PrimaryResult.Type,
			})
		}

		return recentResultsMsg{response: RecentResponse{
			Results: results,
			Count:   len(results),
			Project: project,
		}}
	}
}

func (m model) doListDir(path string) tea.Cmd {
	project := m.project
	projectPath := m.getProjectPath()
	return func() tea.Msg {
		// Read directory directly from filesystem - more reliable than MCP markdown
		if projectPath == "" {
			return dirResultsMsg{err: fmt.Errorf("project path not found")}
		}

		// Build full path
		fullPath := projectPath
		if path != "" && path != "/" {
			fullPath = projectPath + "/" + strings.TrimPrefix(path, "/")
		}

		entries, err := os.ReadDir(fullPath)
		if err != nil {
			return dirResultsMsg{err: fmt.Errorf("list dir failed: %w", err)}
		}

		var items []DirItem
		for _, entry := range entries {
			// Skip hidden files
			if strings.HasPrefix(entry.Name(), ".") {
				continue
			}

			item := DirItem{
				Name: entry.Name(),
				Path: strings.TrimPrefix(path, "/") + "/" + entry.Name(),
			}

			if entry.IsDir() {
				item.Type = "directory"
			} else {
				item.Type = "file"
				// Get file info for size and date
				if info, err := entry.Info(); err == nil {
					item.Size = info.Size()
					item.Date = info.ModTime().Format("2006-01-02")
				}
				// Title is filename without extension for markdown files
				if strings.HasSuffix(entry.Name(), ".md") {
					item.Title = strings.TrimSuffix(entry.Name(), ".md")
				}
			}
			items = append(items, item)
		}

		return dirResultsMsg{response: DirResponse{
			Items:     items,
			Count:     len(items),
			Project:   project,
			Directory: path,
		}}
	}
}

// LaunchTUI starts the terminal user interface.
func LaunchTUI(project string, brainClient *client.BrainClient) error {
	p := tea.NewProgram(
		initialModelWithClient(project, brainClient),
		tea.WithAltScreen(),
		tea.WithMouseCellMotion(),
	)

	if _, err := p.Run(); err != nil {
		return err
	}
	return nil
}
