---
description: Use when setting up new development environment or troubleshooting MCP connectivity. Configures Brain MCP server and plugin prerequisites.
---

# Context Hub Setup

Configure Context Hub's dependencies: Brain MCP server and prerequisite plugins.

## Prerequisites

Context Hub requires these plugins to be installed:

1. **Context7** - Framework documentation (recommended for `/context_gather`)

## Step 1: Check Plugin Prerequisites

First, check if the required plugins are installed:

```bash
claude plugins list
```

Look for:

- `context7` or similar (for framework docs)

**If Context7 is not installed:**

```text
For framework documentation in /context_gather, install Context7:

  claude plugins install context7 --marketplace pleaseai/claude-code-plugins

Or search for it:

  claude plugins search context7
```

## Step 2: Configure Brain MCP

Check if Brain MCP is already configured:

```bash
claude mcp list | grep -i brain
```

If already configured:

- Ask user if they want to reconfigure
- If no, skip to Step 3
- If yes, remove existing first: `claude mcp remove brain`

### Setup Options

Ask the user which setup they prefer:

**Question**: "How would you like to configure Brain MCP?"

**Options**:

1. **Standard (Recommended)** - Zero config, uses default storage
2. **Custom** - Custom memory location, project configuration, etc.

### Standard Setup

```bash
claude mcp add brain --scope user -- npx @brain/mcp-server
```

Confirm success:

```bash
claude mcp list | grep -i brain
```

Report: "Brain MCP is now configured. Your memories will persist in the default Brain storage location."

### Custom Setup

If user chose Custom:

1. Guide through options:
   - **Memory location** - Custom path for memory storage
   - **Project configuration** - Project-specific settings

2. Build appropriate command based on choices.

## Step 3: Verify Complete Setup

Report status of all components:

```text
Context Hub Setup Status:
-------------------------
Brain MCP:      [Configured / Not configured]
Context7 Plugin: [Installed / Not installed - run: claude plugins install context7 --marketplace pleaseai/claude-code-plugins]

Commands available:
- /context_gather - Multi-source context retrieval
- /memory-search, /memory-list, /memory-save, /memory-explore - Memory management
```

## Step 4: Quick Test (Optional)

Offer to test the setup:

**Test Brain MCP:**

```text
/memory-list
```

**Test Context7 (if installed):**

```text
Ask about a framework: "How does FastAPI dependency injection work?"
```

## Troubleshooting

**Brain MCP issues:**

- Check if Brain MCP server is running
- Check Claude Code logs for MCP errors

**Plugin issues:**

- Re-run: `claude plugins install <plugin-name>`
- Check marketplace: `claude plugins search <name>`

## Notes

- Brain MCP config stored in `~/.claude.json` (persists across updates)
- Context7 is a plugin, not an MCP - install via `claude plugins install`
