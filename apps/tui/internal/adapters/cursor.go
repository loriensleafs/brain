package adapters

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// CursorOutput holds all generated files grouped by category.
type CursorOutput struct {
	Agents   []GeneratedFile
	Skills   []GeneratedFile
	Commands []GeneratedFile
	Rules    []GeneratedFile
	Hooks    []GeneratedFile
	MCP      []GeneratedFile
}

// ─── Agent Transform ────────────────────────────────────────────────────────

// CursorTransformAgent transforms a canonical agent into Cursor format.
// Cursor agents use description-only frontmatter (no model, memory, color, tools).
// Output goes to agents/🧠-*.md (Cursor supports .cursor/agents/*.md natively).
// Returns nil if the agent has no Cursor config (e.g., claude-only agents).
func CursorTransformAgent(agent CanonicalAgent, config *AgentPlatformConfig) *GeneratedFile {
	if config == nil {
		return nil
	}

	frontmatter := make(map[string]any)

	// Cursor agent frontmatter
	if config.Description != "" {
		frontmatter["description"] = config.Description
	}

	content := WithFrontmatter(frontmatter, agent.Body)
	return &GeneratedFile{
		RelativePath: "agents/" + BrainPrefix(agent.Name) + ".md",
		Content:      content,
	}
}

// CursorTransformAgents transforms all canonical agents for Cursor.
// Supports both single-file agents and composable agent directories.
func CursorTransformAgents(agentsDir string, brainConfig *BrainConfig) ([]GeneratedFile, error) {
	var results []GeneratedFile

	// Phase 1: Composable agent directories
	entries, err := os.ReadDir(agentsDir)
	if err != nil && !os.IsNotExist(err) {
		return nil, err
	}
	composedNames := make(map[string]bool)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		subDir := filepath.Join(agentsDir, entry.Name())
		if !IsComposableDir(subDir) {
			continue
		}
		gen, err := ComposeAgent(subDir, "cursor", brainConfig)
		if err != nil {
			return nil, fmt.Errorf("compose agent %s: %w", entry.Name(), err)
		}
		if gen != nil {
			results = append(results, *gen)
			composedNames[entry.Name()] = true
		}
	}

	// Phase 2: Single-file agents (skip any that were composed)
	agents, err := ReadCanonicalAgents(agentsDir)
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
		platformConfig := GetAgentPlatformConfig(agentConfig, "cursor")
		generated := CursorTransformAgent(agent, platformConfig)
		if generated != nil {
			results = append(results, *generated)
		}
	}

	return results, nil
}

// ─── Skills Transform ───────────────────────────────────────────────────────

// CursorTransformSkills collects skills for Cursor.
// Skills are copied as-is with emoji prefix on directory name.
// Cursor supports .cursor/skills/*/SKILL.md natively (Open Agent Skills standard).
// Uses the same logic as Claude Code -- skills are format-identical.
func CursorTransformSkills(skillsDir string) ([]GeneratedFile, error) {
	return TransformSkills(skillsDir)
}

// ─── Commands Transform ─────────────────────────────────────────────────────

// CursorTransformCommands collects commands for Cursor.
// Commands are copied as-is with emoji prefix.
// Cursor supports .cursor/commands/*.md natively.
// Supports composable command directories.
func CursorTransformCommands(commandsDir string) ([]GeneratedFile, error) {
	return TransformCommands(commandsDir, "cursor")
}

// ─── Rules Transform ────────────────────────────────────────────────────────

// CursorTransformProtocols transforms protocols into Cursor composable rules
// (.cursor/rules/). Each protocol file becomes a .mdc rule file with emoji prefix.
func CursorTransformProtocols(protocolsDir string) ([]GeneratedFile, error) {
	files, err := ScanMarkdownFiles(protocolsDir)
	if err != nil {
		return nil, nil // directory missing is not an error
	}

	var results []GeneratedFile
	for _, filename := range files {
		content, err := os.ReadFile(filepath.Join(protocolsDir, filename))
		if err != nil {
			continue
		}

		nameWithoutExt := strings.TrimSuffix(filename, ".md")
		prefixed := BrainPrefix(nameWithoutExt) + ".mdc"

		results = append(results, GeneratedFile{
			RelativePath: "rules/" + prefixed,
			Content:      string(content),
		})
	}

	return results, nil
}

// ─── Hooks Transform ────────────────────────────────────────────────────────

// cursorHookEntry represents a hook configuration for Cursor.
type cursorHookEntry struct {
	Event   string `json:"event"`
	Matcher string `json:"matcher,omitempty"`
	Timeout int    `json:"timeout,omitempty"`
}

// CursorTransformHooks generates Cursor hooks JSON merge payload from brain.config.json.
// Produces a merge payload that the Go CLI applies additively to .cursor/hooks.json.
func CursorTransformHooks(hooksDir string, brainConfig *BrainConfig) ([]GeneratedFile, error) {
	var results []GeneratedFile

	if brainConfig.Hooks == nil {
		return results, nil
	}

	// Build hooks merge payload
	hooksContent := make(map[string]any)
	var managedKeys []string

	for hookName, rawConfig := range brainConfig.Hooks {
		// Parse the hook config to extract cursor-specific settings
		var toolConfig map[string]json.RawMessage
		if err := json.Unmarshal(rawConfig, &toolConfig); err != nil {
			continue
		}

		cursorRaw, ok := toolConfig["cursor"]
		if !ok {
			continue
		}

		var cursorConfig cursorHookEntry
		if err := json.Unmarshal(cursorRaw, &cursorConfig); err != nil {
			continue
		}

		entry := map[string]any{
			"matcher": cursorConfig.Matcher,
			"hooks": []map[string]any{
				{
					"type":    "command",
					"command": "hooks/scripts/" + BrainPrefix(hookName) + ".js",
					"timeout": cursorConfig.Timeout,
				},
			},
		}
		if cursorConfig.Timeout == 0 {
			entry["hooks"].([]map[string]any)[0]["timeout"] = 10
		}

		eventKey := cursorConfig.Event
		entries, ok := hooksContent[eventKey]
		if !ok {
			hooksContent[eventKey] = []any{entry}
		} else {
			hooksContent[eventKey] = append(entries.([]any), entry)
		}

		managedKey := "hooks." + eventKey
		if !containsString(managedKeys, managedKey) {
			managedKeys = append(managedKeys, managedKey)
		}
	}

	if len(hooksContent) > 0 {
		payload := JsonMergePayload{
			ManagedKeys: managedKeys,
			Content:     map[string]any{"hooks": hooksContent},
		}

		data, err := json.MarshalIndent(payload, "", "  ")
		if err != nil {
			return nil, fmt.Errorf("marshal hooks payload: %w", err)
		}

		results = append(results, GeneratedFile{
			RelativePath: "hooks/hooks.merge.json",
			Content:      string(data) + "\n",
		})
	}

	// Copy hook scripts with emoji prefix
	scriptsDir := filepath.Join(hooksDir, "scripts")
	scripts, err := ScanAllFiles(scriptsDir)
	if err != nil {
		return results, nil // no scripts directory is fine
	}

	for _, scriptName := range scripts {
		content, err := os.ReadFile(filepath.Join(scriptsDir, scriptName))
		if err != nil {
			continue
		}
		results = append(results, GeneratedFile{
			RelativePath: "hooks/scripts/" + scriptName,
			Content:      string(content),
		})
	}

	return results, nil
}

// ─── MCP Transform ──────────────────────────────────────────────────────────

// CursorTransformMCP transforms canonical mcp.json into Cursor MCP merge payload.
// Produces a merge payload that the Go CLI applies additively to .cursor/mcp.json.
// Resolves relative paths to absolute paths for the MCP server binary.
func CursorTransformMCP(projectRoot string) ([]GeneratedFile, error) {
	mcpPath := filepath.Join(projectRoot, "templates", "configs", "mcp.json")

	data, err := os.ReadFile(mcpPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read mcp.json: %w", err)
	}

	var mcpConfig map[string]any
	if err := json.Unmarshal(data, &mcpConfig); err != nil {
		return nil, nil // invalid mcp.json
	}

	// Resolve relative paths in args to absolute paths
	var managedKeys []string
	if servers, ok := mcpConfig["mcpServers"].(map[string]any); ok {
		for serverName, serverVal := range servers {
			managedKeys = append(managedKeys, "mcpServers."+serverName)

			server, ok := serverVal.(map[string]any)
			if !ok {
				continue
			}

			args, ok := server["args"].([]any)
			if !ok {
				continue
			}

			for i, arg := range args {
				if s, ok := arg.(string); ok && strings.HasPrefix(s, "./") {
					args[i] = filepath.Join(projectRoot, s)
				}
			}
		}
	}

	payload := JsonMergePayload{
		ManagedKeys: managedKeys,
		Content:     mcpConfig,
	}

	payloadData, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal mcp payload: %w", err)
	}

	return []GeneratedFile{
		{
			RelativePath: "mcp/mcp.merge.json",
			Content:      string(payloadData) + "\n",
		},
	}, nil
}

// ─── Source-Aware Transforms ─────────────────────────────────────────────────

// CursorTransformAgentsFromSource transforms agents using a TemplateSource.
func CursorTransformAgentsFromSource(src *TemplateSource, brainConfig *BrainConfig) ([]GeneratedFile, error) {
	var results []GeneratedFile

	entries, err := src.ReadDir("agents")
	if err != nil {
		return nil, nil
	}
	composedNames := make(map[string]bool)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		if !src.Exists("agents/" + entry.Name() + "/_order.yaml") {
			continue
		}
		if !src.IsEmbedded() {
			subDir := filepath.Join(src.TemplatesDir(), "agents", entry.Name())
			gen, err := ComposeAgent(subDir, "cursor", brainConfig)
			if err != nil {
				return nil, fmt.Errorf("compose agent %s: %w", entry.Name(), err)
			}
			if gen != nil {
				results = append(results, *gen)
				composedNames[entry.Name()] = true
			}
		} else {
			gen, err := ComposeAgentFromSource(src, "agents/"+entry.Name(), "cursor", brainConfig)
			if err != nil {
				return nil, fmt.Errorf("compose agent %s: %w", entry.Name(), err)
			}
			if gen != nil {
				results = append(results, *gen)
				composedNames[entry.Name()] = true
			}
		}
	}

	agents, err := ReadCanonicalAgentsFromSource(src, "agents")
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
		platformConfig := GetAgentPlatformConfig(agentConfig, "cursor")
		generated := CursorTransformAgent(agent, platformConfig)
		if generated != nil {
			results = append(results, *generated)
		}
	}

	return results, nil
}

// protocolsAsRules lists protocols that should become .cursor/rules/*.mdc files.
// All others are reference docs installed to .agents/*.md.
var protocolsAsRules = map[string]bool{
	"AGENT-INSTRUCTIONS.md": true,
}

// CursorTransformProtocolsFromSource transforms protocols using a TemplateSource.
// AGENT-INSTRUCTIONS becomes a .mdc rule with alwaysApply: true.
// AGENT-SYSTEM and SESSION-PROTOCOL become reference docs in .agents/.
func CursorTransformProtocolsFromSource(src *TemplateSource) ([]GeneratedFile, error) {
	files, err := ScanMarkdownFilesFromSource(src, "protocols")
	if err != nil {
		return nil, nil
	}

	var results []GeneratedFile
	for _, filename := range files {
		content, err := src.ReadFile("protocols/" + filename)
		if err != nil {
			continue
		}

		if protocolsAsRules[filename] {
			// Install as a Cursor rule with alwaysApply frontmatter
			nameWithoutExt := strings.TrimSuffix(filename, ".md")
			prefixed := BrainPrefix(nameWithoutExt) + ".mdc"

			// Add alwaysApply frontmatter and fix references to point to ~/.agents/
			body := string(content)
			body = strings.ReplaceAll(body, "See `AGENT-SYSTEM.md`", "See `~/.agents/AGENT-SYSTEM.md`")
			body = strings.ReplaceAll(body, "See SESSION-PROTOCOL.md", "See ~/.agents/SESSION-PROTOCOL.md")
			body = strings.ReplaceAll(body, "See `SESSION-PROTOCOL.md`", "See `~/.agents/SESSION-PROTOCOL.md`")

			ruleContent := "---\nalwaysApply: true\n---\n\n" + body

			results = append(results, GeneratedFile{
				RelativePath: "rules/" + prefixed,
				Content:      ruleContent,
			})
		} else {
			// Install as reference doc in .agents/
			nameWithoutExt := strings.TrimSuffix(filename, ".md")
			results = append(results, GeneratedFile{
				RelativePath: ".agents/" + nameWithoutExt + ".md",
				Content:      string(content),
			})
		}
	}

	return results, nil
}

// CursorTransformHooksFromSource generates hooks using a TemplateSource.
// Reads the pre-defined hooks/cursor.json file and wraps it as a JSON merge
// payload so the installer can additively merge into ~/.cursor/hooks.json.
func CursorTransformHooksFromSource(src *TemplateSource, brainConfig *BrainConfig) ([]GeneratedFile, error) {
	var results []GeneratedFile

	// Read the Cursor hooks definition file
	data, err := src.ReadFile("hooks/cursor.json")
	if err != nil {
		return results, nil // no cursor hooks file is fine
	}

	// Parse to extract managed keys
	var hooksFile map[string]any
	if err := json.Unmarshal(data, &hooksFile); err != nil {
		return nil, fmt.Errorf("parse hooks/cursor.json: %w", err)
	}

	var managedKeys []string
	if hooks, ok := hooksFile["hooks"].(map[string]any); ok {
		for eventKey := range hooks {
			managedKeys = append(managedKeys, "hooks."+eventKey)
		}
	}

	// Wrap as a merge payload (content is the entire hooks file)
	payload := JsonMergePayload{
		ManagedKeys: managedKeys,
		Content:     hooksFile,
	}

	payloadData, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal hooks payload: %w", err)
	}

	results = append(results, GeneratedFile{
		RelativePath: "hooks/hooks.merge.json",
		Content:      string(payloadData) + "\n",
	})

	// Copy hook scripts
	scripts, err := ScanAllFilesFromSource(src, "hooks/scripts")
	if err != nil {
		return results, nil
	}

	for _, scriptName := range scripts {
		content, err := src.ReadFile("hooks/scripts/" + scriptName)
		if err != nil {
			continue
		}
		results = append(results, GeneratedFile{
			RelativePath: "hooks/scripts/" + scriptName,
			Content:      string(content),
		})
	}

	return results, nil
}

// CursorTransformMCPFromSource transforms MCP config using a TemplateSource.
func CursorTransformMCPFromSource(src *TemplateSource) ([]GeneratedFile, error) {
	data, err := src.ReadFile("configs/mcp.json")
	if err != nil {
		return nil, nil
	}

	var mcpConfig map[string]any
	if err := json.Unmarshal(data, &mcpConfig); err != nil {
		return nil, nil
	}

	var managedKeys []string
	if servers, ok := mcpConfig["mcpServers"].(map[string]any); ok {
		for serverName, serverVal := range servers {
			managedKeys = append(managedKeys, "mcpServers."+serverName)

			server, ok := serverVal.(map[string]any)
			if !ok {
				continue
			}

			args, ok := server["args"].([]any)
			if !ok {
				continue
			}

			for i, arg := range args {
				if s, ok := arg.(string); ok && strings.HasPrefix(s, "./") {
					args[i] = filepath.Join(src.ProjectRoot(), s)
				}
			}
		}
	}

	payload := JsonMergePayload{
		ManagedKeys: managedKeys,
		Content:     mcpConfig,
	}

	payloadData, err := json.MarshalIndent(payload, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("marshal mcp payload: %w", err)
	}

	return []GeneratedFile{
		{
			RelativePath: "mcp/mcp.merge.json",
			Content:      string(payloadData) + "\n",
		},
	}, nil
}

// CursorTransformFromSource runs all Cursor transforms using a TemplateSource.
func CursorTransformFromSource(src *TemplateSource, brainConfig *BrainConfig) (*CursorOutput, error) {
	agents, err := CursorTransformAgentsFromSource(src, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("transform agents: %w", err)
	}

	skills, err := TransformSkillsFromSource(src)
	if err != nil {
		return nil, fmt.Errorf("transform skills: %w", err)
	}

	commands, err := TransformCommandsFromSource(src, "cursor")
	if err != nil {
		return nil, fmt.Errorf("transform commands: %w", err)
	}

	rules, err := CursorTransformProtocolsFromSource(src)
	if err != nil {
		return nil, fmt.Errorf("transform protocols: %w", err)
	}

	// Compose instructions if the directory is composable
	if src.Exists("rules/_order.yaml") {
		if !src.IsEmbedded() {
			gen, err := ComposeInstructions(filepath.Join(src.TemplatesDir(), "rules"), "cursor")
			if err != nil {
				return nil, fmt.Errorf("compose instructions: %w", err)
			}
			if gen != nil {
				gen.RelativePath = "AGENTS.md"
				rules = append(rules, *gen)
			}
		} else {
			gen, err := ComposeInstructionsFromSource(src, "rules", "cursor")
			if err != nil {
				return nil, fmt.Errorf("compose instructions: %w", err)
			}
			if gen != nil {
				gen.RelativePath = "AGENTS.md"
				rules = append(rules, *gen)
			}
		}
	}

	hooks, err := CursorTransformHooksFromSource(src, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("transform hooks: %w", err)
	}

	mcp, err := CursorTransformMCPFromSource(src)
	if err != nil {
		return nil, fmt.Errorf("transform mcp: %w", err)
	}

	return &CursorOutput{
		Agents:   agents,
		Skills:   skills,
		Commands: commands,
		Rules:    rules,
		Hooks:    hooks,
		MCP:      mcp,
	}, nil
}

// ─── Main Transform ─────────────────────────────────────────────────────────

// CursorTransform runs all Cursor transforms and returns generated files.
// This is the main entry point for the Cursor adapter.
//
// Cursor differences from Claude Code:
//   - Agents use description-only frontmatter (.cursor/agents/🧠-*.md)
//   - Skills and commands are format-identical (🧠 prefix applied)
//   - Protocols become .mdc rules (.cursor/rules/🧠-*.mdc)
//   - No plugin manifest (Cursor has no plugin system)
//   - Hooks and MCP use JSON merge payloads (not direct files)
func CursorTransform(projectRoot string, brainConfig *BrainConfig) (*CursorOutput, error) {
	agentsDir := filepath.Join(projectRoot, "templates", "agents")
	skillsDir := filepath.Join(projectRoot, "templates", "skills")
	commandsDir := filepath.Join(projectRoot, "templates", "commands")
	protocolsDir := filepath.Join(projectRoot, "templates", "protocols")
	hooksDir := filepath.Join(projectRoot, "templates", "hooks")
	instructionsDir := filepath.Join(projectRoot, "templates", "rules")

	agents, err := CursorTransformAgents(agentsDir, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("transform agents: %w", err)
	}

	skills, err := CursorTransformSkills(skillsDir)
	if err != nil {
		return nil, fmt.Errorf("transform skills: %w", err)
	}

	commands, err := CursorTransformCommands(commandsDir)
	if err != nil {
		return nil, fmt.Errorf("transform commands: %w", err)
	}

	rules, err := CursorTransformProtocols(protocolsDir)
	if err != nil {
		return nil, fmt.Errorf("transform protocols: %w", err)
	}

	// Compose instructions if the directory is composable
	if IsComposableDir(instructionsDir) {
		gen, err := ComposeInstructions(instructionsDir, "cursor")
		if err != nil {
			return nil, fmt.Errorf("compose instructions: %w", err)
		}
		if gen != nil {
			// For Cursor, instructions compose into AGENTS.md
			gen.RelativePath = "AGENTS.md"
			rules = append(rules, *gen)
		}
	}

	hooks, err := CursorTransformHooks(hooksDir, brainConfig)
	if err != nil {
		return nil, fmt.Errorf("transform hooks: %w", err)
	}

	mcp, err := CursorTransformMCP(projectRoot)
	if err != nil {
		return nil, fmt.Errorf("transform mcp: %w", err)
	}

	return &CursorOutput{
		Agents:   agents,
		Skills:   skills,
		Commands: commands,
		Rules:    rules,
		Hooks:    hooks,
		MCP:      mcp,
	}, nil
}

// ─── Helpers ────────────────────────────────────────────────────────────────

func containsString(slice []string, s string) bool {
	for _, item := range slice {
		if item == s {
			return true
		}
	}
	return false
}
