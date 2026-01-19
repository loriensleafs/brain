package cmd

import (
	"fmt"
	"os"
	"time"

	"github.com/peterkloss/brain-tui/client"
	"github.com/spf13/cobra"
)

var mcpCmd = &cobra.Command{
	Use:   "mcp",
	Short: "Manage the Brain MCP server",
	Long:  `Manage the Brain MCP server - start, stop, restart, or check status.`,
}

var mcpStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the MCP server in background",
	Run: func(cmd *cobra.Command, args []string) {
		if err := client.StartServer(); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
	},
}

var mcpStopCmd = &cobra.Command{
	Use:   "stop",
	Short: "Stop the MCP server",
	Run: func(cmd *cobra.Command, args []string) {
		if err := client.StopServer(); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
	},
}

var mcpRestartCmd = &cobra.Command{
	Use:   "restart",
	Short: "Restart the MCP server",
	Run: func(cmd *cobra.Command, args []string) {
		_ = client.StopServer() // Ignore error if not running
		time.Sleep(500 * time.Millisecond)
		if err := client.StartServer(); err != nil {
			fmt.Printf("Error: %v\n", err)
			os.Exit(1)
		}
	},
}

var mcpStatusCmd = &cobra.Command{
	Use:   "status",
	Short: "Show MCP server status",
	Run: func(cmd *cobra.Command, args []string) {
		status, err := client.ServerStatus()
		if err != nil {
			fmt.Printf("Brain MCP: %s (%v)\n", status, err)
		} else {
			fmt.Printf("Brain MCP: %s\n", status)
		}
	},
}

func init() {
	rootCmd.AddCommand(mcpCmd)
	mcpCmd.AddCommand(mcpStartCmd)
	mcpCmd.AddCommand(mcpStopCmd)
	mcpCmd.AddCommand(mcpRestartCmd)
	mcpCmd.AddCommand(mcpStatusCmd)
}
