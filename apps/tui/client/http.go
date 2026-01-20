// Package client provides an HTTP client for Brain MCP server communication.
package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync/atomic"
	"syscall"
	"time"
)

// PID file location for headless server management
const pidFile = "/tmp/brain-mcp.pid"

// Session file location for session persistence across CLI invocations
const sessionFile = "/tmp/brain-session.id"

// BrainClient manages HTTP connections to the Brain MCP server.
type BrainClient struct {
	baseURL    string
	httpClient *http.Client
	sessionID  string
	requestID  int64
}

// NewBrainClient creates a new client configured to connect to the Brain MCP server.
// Timeout reduced from 10 minutes to 5 minutes for improved responsiveness.
// With batch API optimization, 700 notes complete in <2 minutes.
func NewBrainClient(baseURL string) *BrainClient {
	return &BrainClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 5 * time.Minute,
		},
	}
}

// DefaultClient returns a client configured for localhost:8765
func DefaultClient() *BrainClient {
	return NewBrainClient("http://127.0.0.1:8765")
}

// HealthStatus represents the server health response.
type HealthStatus struct {
	Status       string    `json:"status"`
	Server       string    `json:"server"`
	Version      string    `json:"version"`
	Uptime       float64   `json:"uptime"`
	SessionCount int       `json:"sessionCount"`
	MemoryUsage  int64     `json:"memoryUsage"`
	Sessions     []Session `json:"sessions"`
}

// Session represents a connected MCP session.
type Session struct {
	ID           string `json:"id"`
	CreatedAt    string `json:"createdAt"`
	LastActivity string `json:"lastActivity"`
	Client       string `json:"client"`
}

// RPCRequest represents a JSON-RPC 2.0 request.
type RPCRequest struct {
	JSONRPC string      `json:"jsonrpc"`
	Method  string      `json:"method"`
	ID      int64       `json:"id"`
	Params  interface{} `json:"params,omitempty"`
}

// RPCResponse represents a JSON-RPC 2.0 response.
type RPCResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   *RPCError       `json:"error,omitempty"`
}

// RPCError represents a JSON-RPC error.
type RPCError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

// FlexibleResponse handles both proper JSON-RPC and simplified error formats.
type FlexibleResponse struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      int64           `json:"id"`
	Result  json.RawMessage `json:"result,omitempty"`
	Error   json.RawMessage `json:"error,omitempty"`
}

// parseResponse parses JSON data handling both proper JSON-RPC errors and string errors.
func parseResponse(data []byte) (*RPCResponse, error) {
	// First try the flexible format
	var flex FlexibleResponse
	if err := json.Unmarshal(data, &flex); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	resp := &RPCResponse{
		JSONRPC: flex.JSONRPC,
		ID:      flex.ID,
		Result:  flex.Result,
	}

	// Parse error field if present
	if len(flex.Error) > 0 {
		// Try structured error first
		var rpcErr RPCError
		if err := json.Unmarshal(flex.Error, &rpcErr); err == nil {
			resp.Error = &rpcErr
		} else {
			// Try string error
			var strErr string
			if err := json.Unmarshal(flex.Error, &strErr); err == nil {
				resp.Error = &RPCError{Code: -32000, Message: strErr}
			} else {
				// Use raw error text
				resp.Error = &RPCError{Code: -32000, Message: string(flex.Error)}
			}
		}
	}

	return resp, nil
}

// ToolCallParams represents parameters for a tools/call request.
type ToolCallParams struct {
	Name      string                 `json:"name"`
	Arguments map[string]interface{} `json:"arguments"`
}

// ToolResult represents the result of a tool call.
type ToolResult struct {
	Content []ContentItem `json:"content"`
	IsError bool          `json:"isError,omitempty"`
}

// ContentItem represents a content item in a tool result.
type ContentItem struct {
	Type string `json:"type"`
	Text string `json:"text,omitempty"`
}

// Health checks if the Brain MCP server is running and returns its status.
func (c *BrainClient) Health() (*HealthStatus, error) {
	resp, err := c.httpClient.Get(c.baseURL + "/health")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("🧠 health check failed: status %d", resp.StatusCode)
	}

	var status HealthStatus
	if err := json.NewDecoder(resp.Body).Decode(&status); err != nil {
		return nil, fmt.Errorf("🧠 failed to decode health response: %w", err)
	}

	return &status, nil
}

// IsRunning returns true if the server is responding to health checks.
func (c *BrainClient) IsRunning() bool {
	status, err := c.Health()
	return err == nil && status.Status == "ok"
}

// loadSessionID loads a previously saved session ID from disk.
func loadSessionID() string {
	data, err := os.ReadFile(sessionFile)
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(data))
}

// saveSessionID saves the session ID to disk for reuse.
func saveSessionID(sessionID string) {
	os.WriteFile(sessionFile, []byte(sessionID), 0644)
}

// isValidSession checks if a session ID is recognized by the server.
func (c *BrainClient) isValidSession(sessionID string) bool {
	health, err := c.Health()
	if err != nil {
		return false
	}
	for _, s := range health.Sessions {
		if s.ID == sessionID {
			return true
		}
	}
	return false
}

// Initialize sends the MCP initialize request and stores the session ID.
// It uses session persistence to reuse sessions across CLI invocations.
func (c *BrainClient) Initialize() error {
	// Try to reuse existing session from disk
	savedSession := loadSessionID()
	if savedSession != "" && c.isValidSession(savedSession) {
		c.sessionID = savedSession
		return nil
	}

	params := map[string]interface{}{
		"protocolVersion": "2025-11-25",
		"clientInfo": map[string]string{
			"name":    "🧠 brain-tui",
			"version": "1.0.0",
		},
		"capabilities": map[string]interface{}{},
	}

	resp, err := c.sendRequest("initialize", params)
	if err != nil {
		return fmt.Errorf("🧠 initialize failed: %w", err)
	}
	defer resp.Body.Close()

	// Store session ID from response header
	if sid := resp.Header.Get("Mcp-Session-Id"); sid != "" {
		c.sessionID = sid
	}

	// Read body to check for errors
	body, _ := io.ReadAll(resp.Body)
	jsonData := extractSSEData(string(body))

	// If there's a response, check for errors
	if jsonData != "" {
		rpcResp, err := parseResponse([]byte(jsonData))
		if err == nil && rpcResp.Error != nil {
			// Check if it's a server error - try to get an existing session
			if strings.Contains(rpcResp.Error.Message, "already initialized") ||
				strings.Contains(rpcResp.Error.Message, "Internal server error") {
				// Try to get a valid session from health endpoint
				health, err := c.Health()
				if err == nil && len(health.Sessions) > 0 {
					// Use the most recent session
					c.sessionID = health.Sessions[len(health.Sessions)-1].ID
					saveSessionID(c.sessionID)
					return nil
				}
			}
			return fmt.Errorf("🧠 initialize failed: %s", rpcResp.Error.Message)
		}
	}

	// Save session ID for future use
	if c.sessionID != "" {
		saveSessionID(c.sessionID)
	}

	return nil
}

// CallTool invokes an MCP tool and returns the raw result.
func (c *BrainClient) CallTool(name string, args map[string]interface{}) (*ToolResult, error) {
	params := ToolCallParams{
		Name:      name,
		Arguments: args,
	}

	resp, err := c.sendRequest("tools/call", params)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("🧠 failed to read response: %w", err)
	}

	// Parse SSE format: "event: message\ndata: {...}\n\n"
	jsonData := extractSSEData(string(body))
	if jsonData == "" {
		return nil, fmt.Errorf("🧠 no data in SSE response")
	}

	rpcResp, err := parseResponse([]byte(jsonData))
	if err != nil {
		return nil, fmt.Errorf("🧠 failed to parse RPC response: %w", err)
	}

	if rpcResp.Error != nil {
		return nil, fmt.Errorf("🧠 MCP error %d: %s", rpcResp.Error.Code, rpcResp.Error.Message)
	}

	var result ToolResult
	if err := json.Unmarshal(rpcResp.Result, &result); err != nil {
		// Try to return raw result as text
		return &ToolResult{
			Content: []ContentItem{{Type: "text", Text: string(rpcResp.Result)}},
		}, nil
	}

	return &result, nil
}

// extractSSEData extracts JSON data from SSE format response
func extractSSEData(body string) string {
	lines := strings.Split(body, "\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "data: ") {
			return strings.TrimPrefix(line, "data: ")
		}
	}
	// If no SSE format, assume it's raw JSON
	return strings.TrimSpace(body)
}

// CallToolJSON calls a tool and unmarshals the result into the provided struct.
func (c *BrainClient) CallToolJSON(name string, args map[string]interface{}, result interface{}) error {
	toolResult, err := c.CallTool(name, args)
	if err != nil {
		return err
	}

	if len(toolResult.Content) == 0 {
		return fmt.Errorf("🧠 empty tool result")
	}

	// Find the text content
	for _, item := range toolResult.Content {
		if item.Type == "text" && item.Text != "" {
			return json.Unmarshal([]byte(item.Text), result)
		}
	}

	return fmt.Errorf("🧠 no text content in tool result")
}

// GetText extracts text content from a tool result.
func (r *ToolResult) GetText() string {
	for _, item := range r.Content {
		if item.Type == "text" {
			return item.Text
		}
	}
	return ""
}

// SessionID returns the current session ID (for debugging).
func (c *BrainClient) SessionID() string {
	return c.sessionID
}

func (c *BrainClient) sendRequest(method string, params interface{}) (*http.Response, error) {
	id := atomic.AddInt64(&c.requestID, 1)

	req := RPCRequest{
		JSONRPC: "2.0",
		Method:  method,
		ID:      id,
		Params:  params,
	}

	body, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("🧠 failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", c.baseURL+"/mcp", bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("🧠 failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Accept", "application/json, text/event-stream")
	if c.sessionID != "" {
		httpReq.Header.Set("Mcp-Session-Id", c.sessionID)
	}

	return c.httpClient.Do(httpReq)
}

// EnsureServerRunning checks if server is running and starts it if not.
// Returns the client ready to use.
func EnsureServerRunning() (*BrainClient, error) {
	client := DefaultClient()

	// Check if already running
	if client.IsRunning() {
		if err := client.Initialize(); err != nil {
			return nil, fmt.Errorf("🧠 failed to initialize session: %w", err)
		}
		return client, nil
	}

	// Start the server
	fmt.Println("🧠 Starting Brain MCP server...")
	bunPath := os.Getenv("HOME") + "/.bun/bin/bun"
	serverPath := os.Getenv("HOME") + "/Dev/brain/apps/mcp/src/index.ts"

	cmd := exec.Command(bunPath, "run", serverPath)
	cmd.Env = append(os.Environ(), "BRAIN_TRANSPORT=http")

	if err := cmd.Start(); err != nil {
		return nil, fmt.Errorf("🧠 failed to start server: %w", err)
	}

	// Don't wait for it - let it run in background
	go cmd.Wait()

	// Wait for server to be ready (up to 60 seconds - may need to start Ollama)
	for i := 0; i < 600; i++ {
		time.Sleep(100 * time.Millisecond)
		if client.IsRunning() {
			if err := client.Initialize(); err != nil {
				return nil, fmt.Errorf("🧠 failed to initialize session: %w", err)
			}
			fmt.Println("🧠 Server ready")
			return client, nil
		}
		// Progress indicator every 5 seconds
		if i > 0 && i%50 == 0 {
			fmt.Printf("   Still starting... (%ds)\n", i/10)
		}
	}

	return nil, fmt.Errorf("🧠 server failed to start within timeout")
}

// StartServer starts the MCP server in background and writes PID file.
// For headless CLI usage (brain mcp start).
func StartServer() error {
	if DefaultClient().IsRunning() {
		return fmt.Errorf("🧠 server already running")
	}

	bunPath := os.Getenv("HOME") + "/.bun/bin/bun"
	serverPath := os.Getenv("HOME") + "/Dev/brain/apps/mcp/src/index.ts"

	cmd := exec.Command(bunPath, "run", serverPath)
	cmd.Env = append(os.Environ(), "BRAIN_TRANSPORT=http")

	// Detach from terminal so it survives shell exit
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("🧠 failed to start: %w", err)
	}

	// Write PID file
	if err := os.WriteFile(pidFile, []byte(fmt.Sprintf("%d", cmd.Process.Pid)), 0644); err != nil {
		return fmt.Errorf("🧠 failed to write pid file: %w", err)
	}

	// Wait for server to be ready (up to 60 seconds - may need to start Ollama)
	fmt.Println("🧠 Starting server (may take a moment if starting Ollama)...")
	for i := 0; i < 600; i++ {
		time.Sleep(100 * time.Millisecond)
		if DefaultClient().IsRunning() {
			fmt.Printf("🧠 Brain MCP started (PID %d)\n", cmd.Process.Pid)
			return nil
		}
		// Progress indicator every 10 seconds
		if i > 0 && i%100 == 0 {
			fmt.Printf("   Still starting... (%ds)\n", i/10)
		}
	}

	return fmt.Errorf("🧠 server failed to start within timeout")
}

// StopServer stops the MCP server using PID file or lsof fallback.
func StopServer() error {
	var stoppedPid int

	// First try PID file
	data, err := os.ReadFile(pidFile)
	if err == nil {
		pid, _ := strconv.Atoi(strings.TrimSpace(string(data)))
		if pid > 0 {
			if proc, err := os.FindProcess(pid); err == nil {
				if err := proc.Signal(syscall.SIGTERM); err == nil {
					os.Remove(pidFile)
					time.Sleep(500 * time.Millisecond)
					fmt.Printf("🧠 Brain MCP stopped (PID %d)\n", pid)
					return nil
				}
			}
		}
	}

	// Fallback: find process by port using lsof
	cmd := exec.Command("lsof", "-ti", ":8765")
	output, err := cmd.Output()
	if err == nil && len(output) > 0 {
		pid, _ := strconv.Atoi(strings.TrimSpace(string(output)))
		if pid > 0 {
			if proc, err := os.FindProcess(pid); err == nil {
				if err := proc.Signal(syscall.SIGTERM); err == nil {
					stoppedPid = pid
				}
			}
		}
	}

	os.Remove(pidFile)

	if stoppedPid > 0 {
		time.Sleep(500 * time.Millisecond)
		fmt.Printf("🧠 Brain MCP stopped (PID %d)\n", stoppedPid)
		return nil
	}

	return fmt.Errorf("🧠 no running server found")
}

// ServerStatus returns current server status as a formatted string.
func ServerStatus() (string, error) {
	client := DefaultClient()
	if !client.IsRunning() {
		return "stopped", nil
	}

	health, err := client.Health()
	if err != nil {
		return "error", err
	}

	return fmt.Sprintf("running (uptime: %.0fs, sessions: %d, memory: %dMB)",
		health.Uptime, health.SessionCount, health.MemoryUsage/1024/1024), nil
}
