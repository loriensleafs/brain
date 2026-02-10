// Package cmd provides CLI commands for Brain TUI including configuration management.
//
// The config command provides a unified interface for managing Brain configuration,
// delegating all operations to the MCP server for consistency and live reconfiguration.
//
// Usage:
//
//	brain config                              # Pretty-printed view
//	brain config --json                       # Machine-readable JSON
//	brain config get <key>                    # Get specific field
//	brain config set <key> <value>            # Set field (triggers reconfiguration)
//	brain config reset [key]                  # Reset field to default
//	brain config reset --all                  # Reset all to defaults
package cmd

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var (
	configJSON     bool
	configResetAll bool
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage Brain configuration",
	Long: `Manage Brain configuration stored at ~/.config/brain/config.json.

All operations delegate to the Brain MCP server which handles:
- Config validation via schema
- Translation to basic-memory config
- Live reconfiguration when values change

Commands:
  brain config                     Show all configuration (pretty-printed)
  brain config --json              Show configuration as JSON
  brain config get <key>           Get a specific configuration value
  brain config set <key> <value>   Set a configuration value
  brain config reset [key]         Reset a field to default
  brain config reset --all         Reset all configuration to defaults

Configuration Keys:
  defaults.memories-location   Default location for memory storage
  defaults.memories-mode       Default mode: DEFAULT, CODE, or CUSTOM
  sync.enabled                 Enable/disable sync (true/false)
  sync.delay-ms                Sync delay in milliseconds
  logging.level                Log level: trace, debug, info, warn, error

Examples:
  brain config
  brain config --json
  brain config get defaults.memories-location
  brain config set defaults.memories-location ~/my-memories
  brain config set logging.level debug
  brain config set sync.delay-ms 1000
  brain config reset logging.level
  brain config reset --all`,
	Args: cobra.NoArgs,
	RunE: runConfigRoot,
}

var configGetCmd = &cobra.Command{
	Use:   "get <key>",
	Short: "Get a configuration value",
	Long: `Get a specific configuration value by key.

Keys use dot notation for nested values:
  defaults.memories-location
  defaults.memories-mode
  sync.enabled
  sync.delay-ms
  logging.level

Examples:
  brain config get defaults.memories-location
  brain config get logging.level`,
	Args: cobra.ExactArgs(1),
	RunE: runConfigGet,
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set a configuration value",
	Long: `Set a configuration value. Changes trigger live reconfiguration.

Keys use dot notation for nested values. Values are automatically
typed (booleans, numbers, strings).

Boolean values: true, false
Number values: integers and floats
String values: everything else

Examples:
  brain config set defaults.memories-location ~/my-memories
  brain config set logging.level debug
  brain config set sync.enabled true
  brain config set sync.delay-ms 1000`,
	Args: cobra.ExactArgs(2),
	RunE: runConfigSet,
}

var configResetCmd = &cobra.Command{
	Use:   "reset [key]",
	Short: "Reset configuration to defaults",
	Long: `Reset configuration field(s) to default values.

Without arguments: requires --all flag for safety
With key: resets that specific field
With --all: resets all configuration to defaults

Examples:
  brain config reset logging.level      Reset single field
  brain config reset --all              Reset all to defaults`,
	Args: cobra.MaximumNArgs(1),
	RunE: runConfigReset,
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configResetCmd)

	// Flags for root config command
	configCmd.Flags().BoolVar(&configJSON, "json", false, "Output configuration as JSON")

	// Flags for reset command
	configResetCmd.Flags().BoolVar(&configResetAll, "all", false, "Reset all configuration to defaults")
}

// runConfigRoot handles 'brain config' - displays full configuration
func runConfigRoot(cmd *cobra.Command, args []string) error {
	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	result, err := brainClient.CallTool("config_get", map[string]any{})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	if isErrorResponse(text) {
		return handleErrorResponse(text)
	}

	if configJSON {
		// Output raw JSON
		fmt.Println(text)
		return nil
	}

	// Pretty-print the configuration
	return prettyPrintConfig(text)
}

// runConfigGet handles 'brain config get <key>'
func runConfigGet(cmd *cobra.Command, args []string) error {
	key := normalizeConfigKey(args[0])

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	result, err := brainClient.CallTool("config_get", map[string]any{
		"key": key,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	if isErrorResponse(text) {
		return handleErrorResponse(text)
	}

	// Output the value directly
	fmt.Println(formatConfigValue(text))
	return nil
}

// runConfigSet handles 'brain config set <key> <value>'
func runConfigSet(cmd *cobra.Command, args []string) error {
	key := normalizeConfigKey(args[0])
	value := parseConfigValue(args[1])

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	result, err := brainClient.CallTool("config_set", map[string]any{
		"key":   key,
		"value": value,
	})
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	if isErrorResponse(text) {
		return handleErrorResponse(text)
	}

	// Parse success response
	var response struct {
		Success           bool   `json:"success"`
		Key               string `json:"key"`
		Value             any    `json:"value"`
		ReconfigTriggered bool   `json:"reconfiguration_triggered"`
	}
	if err := json.Unmarshal([]byte(text), &response); err == nil && response.Success {
		fmt.Printf("[PASS] Set %s = %v\n", response.Key, response.Value)
		if response.ReconfigTriggered {
			fmt.Println("       Reconfiguration triggered")
		}
		return nil
	}

	// Fallback: output raw text
	fmt.Println(text)
	return nil
}

// runConfigReset handles 'brain config reset [key]'
func runConfigReset(cmd *cobra.Command, args []string) error {
	// Require --all flag when no key is specified
	if len(args) == 0 && !configResetAll {
		fmt.Fprintf(os.Stderr, "Error: specify a key or use --all to reset all configuration\n")
		fmt.Fprintf(os.Stderr, "\nUsage:\n")
		fmt.Fprintf(os.Stderr, "  brain config reset <key>   Reset single field\n")
		fmt.Fprintf(os.Stderr, "  brain config reset --all   Reset all to defaults\n")
		return fmt.Errorf("missing key or --all flag")
	}

	brainClient, err := client.EnsureServerRunning()
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	toolArgs := map[string]any{}

	if configResetAll {
		toolArgs["all"] = true
	} else if len(args) > 0 {
		toolArgs["key"] = normalizeConfigKey(args[0])
	}

	result, err := brainClient.CallTool("config_reset", toolArgs)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}

	text := result.GetText()

	// Check for error response
	if isErrorResponse(text) {
		return handleErrorResponse(text)
	}

	// Parse success response
	var response struct {
		Success bool     `json:"success"`
		Reset   []string `json:"reset"`
	}
	if err := json.Unmarshal([]byte(text), &response); err == nil && response.Success {
		if configResetAll {
			fmt.Println("[PASS] Reset all configuration to defaults")
		} else {
			fmt.Printf("[PASS] Reset %s to default\n", toolArgs["key"])
		}
		return nil
	}

	// Fallback: output raw text
	fmt.Println(text)
	return nil
}

// normalizeConfigKey converts user-friendly key names to internal format
// Accepts both dashes and dots: "memories-location" or "memories.location"
// Accepts both "defaults.memories-location" and "default-memories-location"
func normalizeConfigKey(key string) string {
	// Replace dashes with dots for nested keys
	// But preserve dashes in value names like "memories-location"
	parts := strings.Split(key, ".")
	if len(parts) == 1 {
		// Single key - might be shorthand
		key = strings.ReplaceAll(key, "-", ".")
		parts = strings.Split(key, ".")
	}

	// Rebuild key with proper format
	normalized := strings.Join(parts, ".")
	return normalized
}

// parseConfigValue converts string input to appropriate Go type
func parseConfigValue(s string) any {
	// Try boolean
	switch strings.ToLower(s) {
	case "true":
		return true
	case "false":
		return false
	}

	// Try integer
	var i int
	if _, err := fmt.Sscanf(s, "%d", &i); err == nil {
		// Verify it's actually an integer (not a float)
		if fmt.Sprintf("%d", i) == s {
			return i
		}
	}

	// Try float
	var f float64
	if _, err := fmt.Sscanf(s, "%f", &f); err == nil {
		return f
	}

	// String (expand tilde if present)
	if strings.HasPrefix(s, "~") {
		home, err := os.UserHomeDir()
		if err == nil {
			s = strings.Replace(s, "~", home, 1)
		}
	}
	return s
}

// formatConfigValue formats a config value for display
func formatConfigValue(text string) string {
	// Try to parse as JSON and pretty-print
	var value any
	if err := json.Unmarshal([]byte(text), &value); err == nil {
		switch v := value.(type) {
		case string:
			return v
		case bool:
			return fmt.Sprintf("%v", v)
		case float64:
			// Check if it's an integer
			if v == float64(int(v)) {
				return fmt.Sprintf("%.0f", v)
			}
			return fmt.Sprintf("%v", v)
		default:
			// For complex types, pretty-print JSON
			pretty, err := json.MarshalIndent(v, "", "  ")
			if err == nil {
				return string(pretty)
			}
		}
	}
	return text
}

// prettyPrintConfig formats configuration for human-readable output
func prettyPrintConfig(text string) error {
	var config map[string]any
	if err := json.Unmarshal([]byte(text), &config); err != nil {
		// If can't parse, just output raw
		fmt.Println(text)
		return nil
	}

	fmt.Println("Brain Configuration")
	fmt.Println("===================")
	fmt.Println()

	// Print defaults section
	if defaults, ok := config["defaults"].(map[string]any); ok {
		fmt.Println("Defaults:")
		for k, v := range defaults {
			fmt.Printf("  %s: %v\n", k, v)
		}
		fmt.Println()
	}

	// Print projects section
	if projects, ok := config["projects"].(map[string]any); ok {
		if len(projects) > 0 {
			fmt.Println("Projects:")
			for name, proj := range projects {
				fmt.Printf("  %s:\n", name)
				if p, ok := proj.(map[string]any); ok {
					for k, v := range p {
						fmt.Printf("    %s: %v\n", k, v)
					}
				}
			}
			fmt.Println()
		}
	}

	// Print sync section
	if sync, ok := config["sync"].(map[string]any); ok {
		fmt.Println("Sync:")
		for k, v := range sync {
			fmt.Printf("  %s: %v\n", k, v)
		}
		fmt.Println()
	}

	// Print logging section
	if logging, ok := config["logging"].(map[string]any); ok {
		fmt.Println("Logging:")
		for k, v := range logging {
			fmt.Printf("  %s: %v\n", k, v)
		}
		fmt.Println()
	}

	// Print version if present
	if version, ok := config["version"].(string); ok {
		fmt.Printf("Version: %s\n", version)
	}

	return nil
}

// isErrorResponse checks if the response contains an error
func isErrorResponse(text string) bool {
	var resp struct {
		Error string `json:"error"`
	}
	if err := json.Unmarshal([]byte(text), &resp); err == nil {
		return resp.Error != ""
	}
	return false
}

// handleErrorResponse extracts and displays error from response
func handleErrorResponse(text string) error {
	var resp struct {
		Error   string   `json:"error"`
		Details string   `json:"details,omitempty"`
		Valid   []string `json:"valid_keys,omitempty"`
	}
	if err := json.Unmarshal([]byte(text), &resp); err == nil && resp.Error != "" {
		fmt.Fprintf(os.Stderr, "Error: %s\n", resp.Error)
		if resp.Details != "" {
			fmt.Fprintf(os.Stderr, "Details: %s\n", resp.Details)
		}
		if len(resp.Valid) > 0 {
			fmt.Fprintf(os.Stderr, "\nValid keys:\n")
			for _, k := range resp.Valid {
				fmt.Fprintf(os.Stderr, "  %s\n", k)
			}
		}
		return fmt.Errorf("%s", resp.Error)
	}
	return fmt.Errorf("unknown error")
}
