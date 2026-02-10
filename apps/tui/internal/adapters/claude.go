package adapters

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ClaudeCodeOutput holds all generated files grouped by category.
type ClaudeCodeOutput struct {
	Agents   []GeneratedFile
	Skills   []GeneratedFile
	Commands []GeneratedFile
	Rules    []GeneratedFile
	Hooks    []GeneratedFile
	MCP      []GeneratedFile
	Plugin   []GeneratedFile
}

// AllFiles returns every generated file in a single slice.
func (o ClaudeCodeOutput) AllFiles() []GeneratedFile {
	var all []GeneratedFile
	all = append(all, o.Agents...)
	all = append(all, o.Skills...)
	all = append(all, o.Commands...)
	all = append(all, o.Rules...)
	all = append(all, o.Hooks...)
	all = append(all, o.MCP...)
	all = append(all, o.Plugin...)
	return all
}

// ─── Agent Transform ─────────────────────────────────────────────────────────

// TransformClaudeAgent transforms a canonical agent into Claude Code format.
// Adds Claude Code-specific frontmatter from brain.config.json.
// Returns nil if the agent has no Claude Code config (e.g., cursor-only agents).
func TransformClaudeAgent(agent CanonicalAgent, config *AgentPlatformConfig) *GeneratedFile {
	if config == nil {
		return nil
	}

	// Build frontmatter with consistent key ordering
	fm := make(map[string]any)
	fm["name"] = BrainPrefix(agent.Name)

	if config.Model != "" {
		fm["model"] = config.Model
	}
	if config.Description != "" {
		fm["description"] = config.Description
	}
	if config.Memory != "" {
		fm["memory"] = config.Memory
	}
	if config.Color != "" {
		fm["color"] = config.Color
	}
	if config.ArgumentHint != "" {
		fm["argument-hint"] = config.ArgumentHint
	}
	if len(config.AllowedTools) > 0 {
		fm["tools"] = toInterfaceSlice(config.AllowedTools)
	}
	if len(config.Skills) > 0 {
		fm["skills"] = toInterfaceSlice(config.Skills)
	}

	content := WithFrontmatter(fm, agent.Body)
	return &GeneratedFile{
		RelativePath: "agents/" + BrainPrefix(agent.Name) + ".md",
		Content:      content,
	}
}

// TransformClaudeAgents transforms all canonical agents for Claude Code.
func TransformClaudeAgents(agentsDir string, brainConfig *BrainConfig) ([]GeneratedFile, error) {
	agents, err := ReadCanonicalAgents(agentsDir)
	if err != nil {
		return nil, err
	}

	var results []GeneratedFile
	for _, agent := range agents {
		agentConfig, ok := brainConfig.Agents[agent.Name]
		if !ok {
			continue
		}
		platformConfig := GetAgentPlatformConfig(agentConfig, "claude-code")
		gen := TransformClaudeAgent(agent, platformConfig)
		if gen != nil {
			results = append(results, *gen)
		}
	}

	return results, nil
}

// ─── Skills Transform ────────────────────────────────────────────────────────

// TransformSkills collects skills for Claude Code.
// Skills are copied as-is with emoji prefix on directory name.
func TransformSkills(skillsDir string) ([]GeneratedFile, error) {
	// Read top-level skill directories
	entries, err := os.ReadDir(skillsDir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var results []GeneratedFile
	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == ".gitkeep" || entry.Name() == ".DS_Store" {
			continue
		}

		skillDir := entry.Name()
		skillPath := filepath.Join(skillsDir, skillDir)

		// Collect all files recursively within this skill directory
		files, err := CollectFiles(skillPath)
		if err != nil {
			continue
		}

		for _, relFile := range files {
			content, err := os.ReadFile(filepath.Join(skillPath, relFile))
			if err != nil {
				continue
			}
			results = append(results, GeneratedFile{
				RelativePath: "skills/" + BrainPrefix(skillDir) + "/" + relFile,
				Content:      string(content),
			})
		}
	}

	return results, nil
}

// ─── Commands Transform ──────────────────────────────────────────────────────

// TransformCommands collects commands for Claude Code.
// Commands are copied as-is with emoji prefix.
func TransformCommands(commandsDir string) ([]GeneratedFile, error) {
	files, err := ScanMarkdownFiles(commandsDir)
	if err != nil {
		return nil, nil
	}

	var results []GeneratedFile
	for _, file := range files {
		content, err := os.ReadFile(filepath.Join(commandsDir, file))
		if err != nil {
			continue
		}

		prefixed := file
		if !strings.HasPrefix(file, brainEmoji+"-") {
			prefixed = BrainPrefix(strings.TrimSuffix(file, ".md")) + ".md"
		}

		results = append(results, GeneratedFile{
			RelativePath: "commands/" + prefixed,
			Content:      string(content),
		})
	}

	return results, nil
}

// ─── Rules Transform ─────────────────────────────────────────────────────────

// TransformClaudeProtocols transforms protocols into Claude Code composable rules.
// Each protocol file becomes a rule file with emoji prefix.
func TransformClaudeProtocols(protocolsDir string) ([]GeneratedFile, error) {
	files, err := ScanMarkdownFiles(protocolsDir)
	if err != nil {
		return nil, nil
	}

	var results []GeneratedFile
	for _, file := range files {
		content, err := os.ReadFile(filepath.Join(protocolsDir, file))
		if err != nil {
			continue
		}

		prefixed := BrainPrefix(strings.TrimSuffix(file, ".md")) + ".md"

		results = append(results, GeneratedFile{
			RelativePath: "rules/" + prefixed,
			Content:      string(content),
		})
	}

	return results, nil
}

// ─── Hooks Transform ─────────────────────────────────────────────────────────

// TransformClaudeHooks generates Claude Code hooks.json from brain.config.json
// hook mappings and copies hook script files.
func TransformClaudeHooks(hooksDir string, brainConfig *BrainConfig) ([]GeneratedFile, error) {
	var results []GeneratedFile

	// Parse hook config from brain.config.json
	// The hooks section in brain.config.json has a different structure than agents.
	// It contains "source" and "scripts" keys at the top level, not per-hook configs.
	// The actual hook definitions come from a separate hook source file.
	hooksJson, err := buildClaudeHooksJSON(hooksDir, brainConfig)
	if err == nil && hooksJson != "" {
		results = append(results, GeneratedFile{
			RelativePath: "hooks/hooks.json",
			Content:      hooksJson,
		})
	}

	// Copy hook scripts
	scriptsDir := filepath.Join(hooksDir, "scripts")
	files, err := ScanAllFiles(scriptsDir)
	if err != nil {
		return results, nil
	}

	for _, file := range files {
		content, err := os.ReadFile(filepath.Join(scriptsDir, file))
		if err != nil {
			continue
		}
		results = append(results, GeneratedFile{
			RelativePath: "hooks/scripts/" + file,
			Content:      string(content),
		})
	}

	return results, nil
}

// buildClaudeHooksJSON reads the Claude Code hook source file and returns hooks.json content.
func buildClaudeHooksJSON(hooksDir string, brainConfig *BrainConfig) (string, error) {
	// Check if there's a claude-code hook source file specified in config
	hookRaw, ok := brainConfig.Hooks["claude-code"]
	if !ok {
		return "", nil
	}

	var hookConfig struct {
		Source  string `json:"source"`
		Scripts string `json:"scripts"`
	}
	if err := json.Unmarshal(hookRaw, &hookConfig); err != nil {
		return "", err
	}

	if hookConfig.Source == "" {
		return "", nil
	}

	// Read the hook source file (it's already a valid hooks.json)
	// The source is like "hooks/claude-code.json" -- resolve relative to hooksDir parent (templates/)
	templatesDir := filepath.Dir(hooksDir)
	sourceFile := filepath.Join(templatesDir, hookConfig.Source)
	data, err := os.ReadFile(sourceFile)
	if err != nil {
		return "", err
	}

	// Validate it's valid JSON
	var parsed map[string]any
	if err := json.Unmarshal(data, &parsed); err != nil {
		return "", err
	}

	// Return the content as-is (it's already in Claude Code hooks.json format)
	return string(data), nil
}

// ─── MCP Transform ───────────────────────────────────────────────────────────

// TransformClaudeMCP transforms canonical mcp.json into Claude Code format.
// Resolves relative paths (starting with ./) to absolute paths.
func TransformClaudeMCP(projectRoot string) ([]GeneratedFile, error) {
	mcpPath := filepath.Join(projectRoot, "templates", "mcp.json")
	data, err := os.ReadFile(mcpPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}

	var mcpConfig map[string]any
	if err := json.Unmarshal(data, &mcpConfig); err != nil {
		return nil, nil
	}

	// Resolve relative paths in mcpServers args
	if servers, ok := mcpConfig["mcpServers"].(map[string]any); ok {
		for _, serverRaw := range servers {
			server, ok := serverRaw.(map[string]any)
			if !ok {
				continue
			}
			argsRaw, ok := server["args"].([]any)
			if !ok {
				continue
			}
			for i, argRaw := range argsRaw {
				arg, ok := argRaw.(string)
				if !ok {
					continue
				}
				if strings.HasPrefix(arg, "./") {
					argsRaw[i] = filepath.Join(projectRoot, arg)
				}
			}
		}
	}

	content, err := json.MarshalIndent(mcpConfig, "", "  ")
	if err != nil {
		return nil, nil
	}

	return []GeneratedFile{
		{
			RelativePath: ".mcp.json",
			Content:      string(content) + "\n",
		},
	}, nil
}

// ─── Plugin Manifest ─────────────────────────────────────────────────────────

// GenerateClaudePluginManifest generates the Claude Code plugin manifest.
func GenerateClaudePluginManifest() []GeneratedFile {
	manifest := map[string]any{
		"name":        brainEmoji,
		"description": "Brain knowledge graph + workflow mode management",
		"author": map[string]any{
			"name": "Peter Kloss",
		},
	}

	content, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return nil
	}

	return []GeneratedFile{
		{
			RelativePath: ".claude-plugin/plugin.json",
			Content:      string(content) + "\n",
		},
	}
}

// ─── Main Transform ──────────────────────────────────────────────────────────

// TransformClaudeCode runs all Claude Code transforms and returns generated files.
// This is the main entry point for the Claude Code adapter.
func TransformClaudeCode(projectRoot string, brainConfig *BrainConfig) (*ClaudeCodeOutput, error) {
	agentsDir := filepath.Join(projectRoot, "templates", "agents")
	skillsDir := filepath.Join(projectRoot, "templates", "skills")
	commandsDir := filepath.Join(projectRoot, "templates", "commands")
	protocolsDir := filepath.Join(projectRoot, "templates", "protocols")
	hooksDir := filepath.Join(projectRoot, "templates", "hooks")

	agents, err := TransformClaudeAgents(agentsDir, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("transform agents: %w", err)
	}

	skills, err := TransformSkills(skillsDir)
	if err != nil {
		return nil, fmt.Errorf("transform skills: %w", err)
	}

	commands, err := TransformCommands(commandsDir)
	if err != nil {
		return nil, fmt.Errorf("transform commands: %w", err)
	}

	rules, err := TransformClaudeProtocols(protocolsDir)
	if err != nil {
		return nil, fmt.Errorf("transform protocols: %w", err)
	}

	hooks, err := TransformClaudeHooks(hooksDir, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("transform hooks: %w", err)
	}

	mcp, err := TransformClaudeMCP(projectRoot)
	if err != nil {
		return nil, fmt.Errorf("transform mcp: %w", err)
	}

	return &ClaudeCodeOutput{
		Agents:   agents,
		Skills:   skills,
		Commands: commands,
		Rules:    rules,
		Hooks:    hooks,
		MCP:      mcp,
		Plugin:   GenerateClaudePluginManifest(),
	}, nil
}
