package installer

import (
	"encoding/json"
	"fmt"
	"path/filepath"
	"slices"
	"strings"
)

// BuildOutput groups GeneratedFile slices by content type.
// Each field corresponds to a distinct install phase in the placement strategy.
type BuildOutput struct {
	Agents   []GeneratedFile
	Skills   []GeneratedFile
	Commands []GeneratedFile
	Rules    []GeneratedFile
	Hooks    []GeneratedFile
	MCP      []GeneratedFile
	Plugin   []GeneratedFile
}

// AllFiles returns every generated file in a single slice.
func (o *BuildOutput) AllFiles() []GeneratedFile {
	return slices.Concat(o.Agents, o.Skills, o.Commands, o.Rules, o.Hooks, o.MCP, o.Plugin)
}

// BuildAll runs all build phases parameterized by the ToolConfig.
// All behavior differences come from the config.
func BuildAll(src *TemplateSource, tool *ToolConfig, brainConfig *Config) (*BuildOutput, error) {
	out := &BuildOutput{}

	agents, err := buildAgents(src, tool, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("build agents: %w", err)
	}
	out.Agents = agents

	skills, err := buildSkills(src, tool)
	if err != nil {
		return nil, fmt.Errorf("build skills: %w", err)
	}
	out.Skills = skills

	commands, err := buildCommands(src, tool)
	if err != nil {
		return nil, fmt.Errorf("build commands: %w", err)
	}
	out.Commands = commands

	rules, err := buildRules(src, tool, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("build rules: %w", err)
	}
	out.Rules = rules

	hooks, err := BuildHooks(src, tool, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("build hooks: %w", err)
	}
	out.Hooks = hooks

	mcp, err := BuildMCP(src, tool)
	if err != nil {
		return nil, fmt.Errorf("build mcp: %w", err)
	}
	out.MCP = mcp

	plugin := BuildPlugin(tool)
	out.Plugin = plugin

	return out, nil
}

// ---- Agent Build ------------------------------------------------------------

// buildAgents builds canonical agents using config-driven frontmatter fields.
// Supports both single-file agents and composable agent directories.
func buildAgents(src *TemplateSource, tool *ToolConfig, brainConfig *Config) ([]GeneratedFile, error) {
	var results []GeneratedFile

	// Phase 1: Composable agent directories (contain _order.yaml)
	entries, err := src.ReadDir(AgentsDir)
	if err != nil {
		return nil, nil
	}
	composedNames := make(map[string]bool)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if !src.Exists(AgentsDir + "/" + entry.Name() + "/_order.yaml") {
			continue
		}
		gen, err := composeAgentGeneric(src, entry.Name(), tool, brainConfig)
		if err != nil {
			return nil, fmt.Errorf("compose agent %s: %w", entry.Name(), err)
		}
		if gen != nil {
			results = append(results, *gen)
			composedNames[entry.Name()] = true
		}
	}

	// Phase 2: Single-file agents (skip any that were composed)
	agents, err := ReadAgents(src, AgentsDir)
	if err != nil {
		return nil, err
	}

	for _, agent := range agents {
		if composedNames[agent.Name] {
			continue
		}
		agentConfig, ok := brainConfig.Agents[agent.Name]
		if !ok {
			continue
		}
		platformConfig := GetAgentFrontmatter(agentConfig, tool.Name)
		gen := buildAgent(agent, platformConfig, tool)
		if gen != nil {
			results = append(results, *gen)
		}
	}

	return results, nil
}

// composeAgentGeneric composes an agent from a composable directory using config-driven behavior.
func composeAgentGeneric(src *TemplateSource, agentName string, tool *ToolConfig, brainConfig *Config) (*GeneratedFile, error) {
	agentConfig, ok := brainConfig.Agents[agentName]
	if !ok {
		return nil, nil
	}
	platformConfig := GetAgentFrontmatter(agentConfig, tool.Name)
	if platformConfig == nil {
		return nil, nil
	}

	content, err := Compose(src, AgentsDir+"/"+agentName, tool.Name, nil)
	if err != nil {
		return nil, fmt.Errorf("compose agent %s: %w", agentName, err)
	}

	fm := BuildAgentFrontmatter(agentName, platformConfig, tool)
	result := WithFrontmatter(fm, content)

	return &GeneratedFile{
		RelativePath: AgentsDir + "/" + MaybePrefix(agentName, tool.Prefix) + ".md",
		Content:      result,
	}, nil
}

// buildAgent builds a single-file canonical agent using config-driven frontmatter.
func buildAgent(agent CanonicalAgent, config *AgentFrontmatter, tool *ToolConfig) *GeneratedFile {
	if config == nil {
		return nil
	}

	fm := BuildAgentFrontmatter(agent.Name, config, tool)
	content := WithFrontmatter(fm, agent.Body)

	return &GeneratedFile{
		RelativePath: AgentsDir + "/" + MaybePrefix(agent.Name, tool.Prefix) + ".md",
		Content:      content,
	}
}

// BuildAgentFrontmatter builds frontmatter using ONLY the fields listed in tool.Agents.Frontmatter.
// This is the key config-driven behavior: Claude Code lists 8 fields, Cursor lists 1.
func BuildAgentFrontmatter(agentName string, config *AgentFrontmatter, tool *ToolConfig) map[string]any {
	fm := make(map[string]any)

	for _, field := range tool.Agents.Frontmatter {
		switch field {
		case "name":
			fm["name"] = MaybePrefix(agentName, tool.Prefix)
		case "model":
			if config.Model != "" {
				fm["model"] = config.Model
			}
		case "description":
			if config.Description != "" {
				fm["description"] = config.Description
			}
		case "memory":
			if config.Memory != "" {
				fm["memory"] = config.Memory
			}
		case "color":
			if config.Color != "" {
				fm["color"] = config.Color
			}
		case "argument-hint":
			if config.ArgumentHint != "" {
				fm["argument-hint"] = config.ArgumentHint
			}
		case "tools":
			if len(config.AllowedTools) > 0 {
				fm["tools"] = ToInterfaceSlice(config.AllowedTools)
			}
		case "skills":
			if len(config.Skills) > 0 {
				fm["skills"] = ToInterfaceSlice(config.Skills)
			}
		}
	}

	return fm
}

// ---- Skills Build -----------------------------------------------------------

// buildSkills collects skills for the target tool.
// Applies prefix from tool.Prefix to skill directory names.
func buildSkills(src *TemplateSource, tool *ToolConfig) ([]GeneratedFile, error) {
	entries, err := src.ReadDir(SkillsDir)
	if err != nil {
		return nil, nil
	}

	var results []GeneratedFile
	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == ".gitkeep" || entry.Name() == ".DS_Store" {
			continue
		}

		skillDir := entry.Name()
		relSkillDir := SkillsDir + "/" + skillDir

		files, err := WalkFiles(src, relSkillDir)
		if err != nil {
			continue
		}

		for _, relFile := range files {
			content, err := src.ReadFile(relSkillDir + "/" + relFile)
			if err != nil {
				continue
			}
			results = append(results, GeneratedFile{
				RelativePath: SkillsDir + "/" + MaybePrefix(skillDir, tool.Prefix) + "/" + relFile,
				Content:      string(content),
			})
		}
	}

	return results, nil
}

// ---- Commands Build ---------------------------------------------------------

// buildCommands collects commands for the target tool.
// Supports both single-file commands and composable command directories.
func buildCommands(src *TemplateSource, tool *ToolConfig) ([]GeneratedFile, error) {
	var results []GeneratedFile

	entries, err := src.ReadDir(CommandsDir)
	if err != nil {
		return nil, nil
	}

	composedNames := make(map[string]bool)

	// Phase 1: Composable command directories
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if !src.Exists(CommandsDir + "/" + entry.Name() + "/_order.yaml") {
			continue
		}

		commandName := entry.Name()
		content, err := Compose(src, CommandsDir+"/"+commandName, tool.Name, nil)
		if err != nil {
			return nil, fmt.Errorf("compose command %s: %w", commandName, err)
		}
		results = append(results, GeneratedFile{
			RelativePath: CommandsDir + "/" + MaybePrefix(commandName, tool.Prefix) + ".md",
			Content:      content,
		})
		composedNames[commandName] = true
	}

	// Phase 2: Single-file commands
	allCmdFiles, err := ListFiles(src, CommandsDir)
	if err != nil {
		return results, nil
	}

	for _, file := range allCmdFiles {
		if !strings.HasSuffix(file, ".md") {
			continue
		}
		content, err := src.ReadFile(CommandsDir + "/" + file)
		if err != nil {
			continue
		}

		prefixed := file
		if tool.Prefix && !strings.HasPrefix(file, BrainEmoji+"-") {
			prefixed = BrainPrefix(strings.TrimSuffix(file, ".md")) + ".md"
		}

		results = append(results, GeneratedFile{
			RelativePath: CommandsDir + "/" + prefixed,
			Content:      string(content),
		})
	}

	return results, nil
}

// ---- Rules Build ------------------------------------------------------------

// buildRules builds protocols into rules using config-driven behavior.
// Uses tool.Rules.Extension for output file extension.
// Uses tool.Rules.ExtraFrontmatter for additional frontmatter (e.g., alwaysApply: true).
// Uses tool.Rules.Routing to dispatch specific protocols to alternate output directories.
// Also composes instructions if the rules composable directory exists.
func buildRules(src *TemplateSource, tool *ToolConfig, brainConfig *Config) ([]GeneratedFile, error) {
	allProtoFiles, err := ListFiles(src, ProtocolsDir)
	if err != nil {
		return nil, nil
	}

	var results []GeneratedFile
	for _, filename := range allProtoFiles {
		if !strings.HasSuffix(filename, ".md") {
			continue
		}
		content, err := src.ReadFile(ProtocolsDir + "/" + filename)
		if err != nil {
			continue
		}

		// Check routing: some protocols may go to alternate directories
		if altDir, routed := tool.Rules.Routing[filename]; routed {
			nameWithoutExt := strings.TrimSuffix(filename, ".md")
			results = append(results, GeneratedFile{
				RelativePath: altDir + nameWithoutExt + ".md",
				Content:      string(content),
			})
			continue
		}

		nameWithoutExt := strings.TrimSuffix(filename, ".md")
		prefixed := MaybePrefix(nameWithoutExt, tool.Prefix) + tool.Rules.Extension

		body := string(content)

		// Apply extra frontmatter if configured
		if len(tool.Rules.ExtraFrontmatter) > 0 {
			body = WithFrontmatter(tool.Rules.ExtraFrontmatter, body)
		}

		results = append(results, GeneratedFile{
			RelativePath: RulesDir + "/" + prefixed,
			Content:      body,
		})
	}

	// Compose instructions if the composable directory exists
	if src.Exists(RulesDir + "/_order.yaml") {
		content, err := Compose(src, RulesDir, tool.Name, nil)
		if err != nil {
			return nil, fmt.Errorf("compose instructions: %w", err)
		}
		relPath := "AGENTS.md"
		if tool.Rules.InstructionsPath != "" {
			relPath = tool.Rules.InstructionsPath
		}
		results = append(results, GeneratedFile{
			RelativePath: relPath,
			Content:      content,
		})
	}

	return results, nil
}

// ---- Hooks Build ------------------------------------------------------------

// BuildHooks dispatches on tool.Hooks.Strategy:
//   - "direct": read hook source from brainConfig, copy as-is plus scripts
//   - "merge": read tool-specific hook file and wrap as JSON merge payload
//   - "none": skip hooks entirely
func BuildHooks(src *TemplateSource, tool *ToolConfig, brainConfig *Config) ([]GeneratedFile, error) {
	switch tool.Hooks.Strategy {
	case "direct":
		return buildHooksDirect(src, tool, brainConfig)
	case "merge":
		return BuildHooksMerge(src, tool)
	case "none":
		return nil, nil
	default:
		return nil, fmt.Errorf("unknown hooks strategy: %s", tool.Hooks.Strategy)
	}
}

// buildHooksDirect reads the hook source from brainConfig and copies it directly.
// Also copies hook scripts. This matches Claude Code behavior.
func buildHooksDirect(src *TemplateSource, tool *ToolConfig, brainConfig *Config) ([]GeneratedFile, error) {
	hookRaw, ok := brainConfig.Hooks[tool.Name]
	if !ok {
		return nil, nil
	}

	var hookConfig struct {
		Source  string `json:"source"`
		Scripts string `json:"scripts"`
	}
	if err := json.Unmarshal(hookRaw, &hookConfig); err != nil {
		return nil, nil
	}

	var results []GeneratedFile
	if hookConfig.Source != "" {
		data, err := src.ReadFile(hookConfig.Source)
		if err == nil {
			var parsed map[string]any
			if json.Unmarshal(data, &parsed) == nil {
				results = append(results, GeneratedFile{
					RelativePath: tool.Hooks.Target,
					Content:      string(data),
				})
			}
		}
	}

	return append(results, collectHookScripts(src)...), nil
}

// BuildHooksMerge reads a tool-specific hook file and wraps it as a JSON merge payload.
// This matches Cursor behavior.
func BuildHooksMerge(src *TemplateSource, tool *ToolConfig) ([]GeneratedFile, error) {
	data, err := src.ReadFile(HooksDir + "/" + tool.Name + ".json")
	if err != nil {
		return nil, nil
	}

	var hooksFile map[string]any
	if err := json.Unmarshal(data, &hooksFile); err != nil {
		return nil, fmt.Errorf("parse %s/%s.json: %w", HooksDir, tool.Name, err)
	}

	var managedKeys []string
	if hooks, ok := hooksFile["hooks"].(map[string]any); ok {
		for eventKey := range hooks {
			managedKeys = append(managedKeys, "hooks."+eventKey)
		}
	}

	payloadContent, err := buildMergePayload(hooksFile, managedKeys)
	if err != nil {
		return nil, fmt.Errorf("marshal hooks payload: %w", err)
	}

	results := []GeneratedFile{
		{
			RelativePath: buildMergeFilePath(tool.Hooks.Target),
			Content:      payloadContent,
		},
	}
	return append(results, collectHookScripts(src)...), nil
}

// ---- MCP Build --------------------------------------------------------------

// BuildMCP dispatches on tool.MCP.Strategy:
//   - "direct": resolve paths and write directly to target
//   - "merge": resolve paths and wrap as JSON merge payload
//   - "none": skip MCP entirely
func BuildMCP(src *TemplateSource, tool *ToolConfig) ([]GeneratedFile, error) {
	switch tool.MCP.Strategy {
	case "direct":
		return buildMCPDirect(src, tool)
	case "merge":
		return BuildMCPMerge(src, tool)
	case "none":
		return nil, nil
	default:
		return nil, fmt.Errorf("unknown mcp strategy: %s", tool.MCP.Strategy)
	}
}

// buildMCPDirect reads mcp.json, resolves relative paths, and writes directly.
// This matches Claude Code behavior.
func buildMCPDirect(src *TemplateSource, tool *ToolConfig) ([]GeneratedFile, error) {
	data, err := src.ReadFile(ConfigsDir + "/mcp.json")
	if err != nil {
		return nil, nil
	}

	var mcpConfig map[string]any
	if err := json.Unmarshal(data, &mcpConfig); err != nil {
		return nil, nil
	}

	ResolveMCPPaths(mcpConfig, src.ProjectRoot())

	content, err := json.MarshalIndent(mcpConfig, "", "  ")
	if err != nil {
		return nil, nil
	}

	return []GeneratedFile{
		{
			RelativePath: tool.MCP.Target,
			Content:      string(content) + "\n",
		},
	}, nil
}

// BuildMCPMerge reads mcp.json, resolves paths, and wraps as a JSON merge payload.
// This matches Cursor behavior.
func BuildMCPMerge(src *TemplateSource, tool *ToolConfig) ([]GeneratedFile, error) {
	data, err := src.ReadFile(ConfigsDir + "/mcp.json")
	if err != nil {
		return nil, nil
	}

	var mcpConfig map[string]any
	if err := json.Unmarshal(data, &mcpConfig); err != nil {
		return nil, nil
	}

	ResolveMCPPaths(mcpConfig, src.ProjectRoot())

	var managedKeys []string
	if servers, ok := mcpConfig["mcpServers"].(map[string]any); ok {
		for serverName := range servers {
			managedKeys = append(managedKeys, "mcpServers."+serverName)
		}
	}

	payloadContent, err := buildMergePayload(mcpConfig, managedKeys)
	if err != nil {
		return nil, fmt.Errorf("marshal mcp payload: %w", err)
	}

	return []GeneratedFile{
		{
			RelativePath: buildMergeFilePath(tool.MCP.Target),
			Content:      payloadContent,
		},
	}, nil
}

// ResolveMCPPaths resolves relative paths (starting with ./) to absolute paths
// in MCP server args.
func ResolveMCPPaths(mcpConfig map[string]any, projectRoot string) {
	servers, ok := mcpConfig["mcpServers"].(map[string]any)
	if !ok {
		return
	}
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

// ---- Shared Helpers ---------------------------------------------------------

// collectHookScripts reads all files from hooks/scripts/ and returns them as GeneratedFiles.
func collectHookScripts(src *TemplateSource) []GeneratedFile {
	files, err := ListFiles(src, HooksDir+"/scripts")
	if err != nil {
		return nil
	}

	var results []GeneratedFile
	for _, name := range files {
		content, err := src.ReadFile(HooksDir + "/scripts/" + name)
		if err != nil {
			continue
		}
		results = append(results, GeneratedFile{
			RelativePath: HooksDir + "/scripts/" + name,
			Content:      string(content),
		})
	}
	return results
}

// buildMergeFilePath computes the .merge.json output path from a config target path.
// For target "hooks.json" it returns "hooks.merge.json".
// For target "subdir/mcp.json" it returns "subdir/mcp.merge.json".
func buildMergeFilePath(target string) string {
	dir := filepath.Dir(target)
	base := strings.TrimSuffix(filepath.Base(target), filepath.Ext(target))
	mergeFile := base + ".merge.json"
	if dir != "." {
		return dir + "/" + mergeFile
	}
	return mergeFile
}

// buildMergePayload wraps content and managed keys into a JSON merge payload file.
func buildMergePayload(content map[string]any, managedKeys []string) (string, error) {
	payload := MergePayload{
		ManagedKeys: managedKeys,
		Content:     content,
	}
	data, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return "", err
	}
	return string(data) + "\n", nil
}

// ---- Plugin Manifest --------------------------------------------------------

// BuildPlugin generates plugin manifest files if configured.
// Dispatches on tool.Manifest.Type:
//   - "marketplace": generate plugin.json + marketplace.json
//   - "file_list": no plugin files (placement tracks files directly)
func BuildPlugin(tool *ToolConfig) []GeneratedFile {
	if tool.Manifest.Type != "marketplace" {
		return nil
	}

	plugin := map[string]any{
		"name":        BrainEmoji,
		"description": "Brain knowledge graph + workflow mode management",
		"author": map[string]any{
			"name": "Peter Kloss",
		},
	}

	marketplace := map[string]any{
		"name": "brain",
		"owner": map[string]any{
			"name": "Peter Kloss",
		},
		"plugins": []map[string]any{
			{
				"name":        "brain",
				"source":      "./",
				"description": "Brain knowledge graph + workflow mode management",
			},
		},
	}

	pluginContent, err := json.MarshalIndent(plugin, "", "  ")
	if err != nil {
		return nil
	}

	marketplaceContent, err := json.MarshalIndent(marketplace, "", "  ")
	if err != nil {
		return nil
	}

	return []GeneratedFile{
		{
			RelativePath: ".claude-plugin/plugin.json",
			Content:      string(pluginContent) + "\n",
		},
		{
			RelativePath: ".claude-plugin/marketplace.json",
			Content:      string(marketplaceContent) + "\n",
		},
	}
}

