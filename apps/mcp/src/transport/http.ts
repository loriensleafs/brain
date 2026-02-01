/**
 * HTTP transport for Brain MCP server using Hono + Bun.
 * Pure Web standards - no Node.js types.
 *
 * Used when running in HTTP mode for TUI management.
 * Supports multiple concurrent sessions with session tracking.
 *
 * Inngest integration uses graceful degradation - if Inngest dev server
 * is unavailable, the /api/inngest endpoint returns 503 with clear message.
 */

import { StreamableHTTPTransport } from "@hono/mcp";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Context } from "hono";
import { Hono } from "hono";
import { serve as serveInngest } from "inngest/bun";
import { config } from "../config";
import {
	getInngestClient,
	getWorkflowFunctions,
	isWorkflowAvailable,
} from "../services/inngest";
import { logger } from "../utils/internal/logger";

/**
 * Session tracking for connected clients
 */
interface SessionState {
	createdAt: number;
	lastActivity: number;
	clientInfo?: string;
}

const sessions = new Map<string, SessionState>();

/**
 * Start the server with HTTP transport using Hono + Bun.
 * Includes health endpoint for monitoring.
 */
export async function startHttpTransport(server: McpServer): Promise<void> {
	const app = new Hono();

	// Generate session ID for this transport instance
	const serverSessionId = crypto.randomUUID();

	// Use @hono/mcp transport (Web standards, not Node.js)
	const transport = new StreamableHTTPTransport({
		sessionIdGenerator: () => serverSessionId,
	});

	// Inngest handler (Bun-native, returns Response directly)
	// Uses graceful degradation - handler created even if unavailable
	const inngestClient = getInngestClient();
	const workflowFunctions = getWorkflowFunctions();
	const inngestHandler = serveInngest({
		client: inngestClient,
		functions: workflowFunctions,
	});

	// Health endpoint
	app.get("/health", (c) => {
		const sessionList = Array.from(sessions.entries()).map(([id, state]) => ({
			id,
			createdAt: new Date(state.createdAt).toISOString(),
			lastActivity: new Date(state.lastActivity).toISOString(),
			client: state.clientInfo,
		}));

		const workflowAvailable = isWorkflowAvailable();
		const health = {
			status: "ok",
			server: "🧠 brain",
			version: "1.0.0",
			uptime: process.uptime(),
			sessions: sessionList,
			sessionCount: sessions.size,
			memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
			workflow: {
				available: workflowAvailable,
				message: workflowAvailable
					? "Inngest workflow features enabled"
					: "Inngest unavailable - start dev server with: npx inngest-cli@latest dev",
			},
		};

		return c.json(health);
	});

	// Inngest endpoint - Bun handler takes Request, returns Response
	// Returns 503 when Inngest is unavailable with clear message
	app.all("/api/inngest", async (c) => {
		if (!isWorkflowAvailable()) {
			logger.info("Inngest endpoint called but workflow unavailable");
			return c.json(
				{
					error: "Workflow features unavailable",
					message:
						"Inngest dev server not running. Start with: npx inngest-cli@latest dev",
					available: false,
				},
				503,
			);
		}
		return inngestHandler(c.req.raw);
	});

	// MCP endpoint handler (shared logic)
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const handleMcpRequest = async (c: Context<any, any, any>) => {
		// Track session activity
		const sessionId = c.req.header("mcp-session-id");
		if (sessionId) {
			const session = sessions.get(sessionId);
			if (session) {
				session.lastActivity = Date.now();
			} else {
				sessions.set(sessionId, {
					createdAt: Date.now(),
					lastActivity: Date.now(),
				});
				logger.info({ sessionId }, "New session created");
			}
		}

		// Parse body for POST requests
		let parsedBody: unknown;
		if (c.req.method === "POST") {
			try {
				parsedBody = await c.req.json();
			} catch {
				// Empty body or invalid JSON is okay for some requests
				parsedBody = undefined;
			}
		}

		try {
			// Handle with @hono/mcp transport
			const response = await transport.handleRequest(c, parsedBody);

			// Add session ID header to response
			if (response) {
				const headers = new Headers(response.headers);
				headers.set("Mcp-Session-Id", serverSessionId);
				return new Response(response.body, {
					status: response.status,
					statusText: response.statusText,
					headers,
				});
			}

			// No response from transport, return 204
			return new Response(null, {
				status: 204,
				headers: { "Mcp-Session-Id": serverSessionId },
			});
		} catch (error) {
			logger.error({ error }, "Error handling MCP request");
			return c.json({ error: "Internal server error" }, 500);
		}
	};

	// MCP routes
	app.all("/mcp", handleMcpRequest);
	app.all("/mcp/*", handleMcpRequest);

	// Root fallback for MCP (some clients connect to /)
	app.all("/", handleMcpRequest);

	// Connect MCP server to transport
	await server.connect(transport);

	// Start Bun server via Hono
	const bunServer = Bun.serve({
		port: config.httpPort,
		hostname: config.httpHost,
		fetch: app.fetch,
		idleTimeout: 0, // Disable timeout for long-running MCP tool calls (embed takes 47+ seconds)
	});

	logger.info(
		{
			host: config.httpHost,
			port: config.httpPort,
			url: `http://${config.httpHost}:${config.httpPort}`,
		},
		"HTTP transport started (Bun + Hono)",
	);

	// Cleanup on shutdown
	const shutdown = () => {
		logger.info("Shutting down HTTP server");
		bunServer.stop();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);
}

/**
 * Get current session count
 */
export function getSessionCount(): number {
	return sessions.size;
}

/**
 * Cleanup stale sessions (older than 1 hour)
 */
export function cleanupStaleSessions(): number {
	const oneHourAgo = Date.now() - 60 * 60 * 1000;
	let cleaned = 0;

	for (const [id, session] of sessions) {
		if (session.lastActivity < oneHourAgo) {
			sessions.delete(id);
			cleaned++;
		}
	}

	if (cleaned > 0) {
		logger.info({ cleaned }, "Cleaned up stale sessions");
	}

	return cleaned;
}
