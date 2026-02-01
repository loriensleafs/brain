/**
 * Basic-memory subprocess client management.
 *
 * Spawns and maintains connection to the basic-memory MCP server
 * as a subprocess, communicating via stdio transport.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { config } from "../config";
import { logger } from "../utils/internal/logger";

let client: Client | null = null;
let transport: StdioClientTransport | null = null;
let connectionPromise: Promise<Client> | null = null;

/**
 * Get or create the basic-memory client connection.
 * Handles reconnection if the subprocess dies.
 */
export async function getBasicMemoryClient(): Promise<Client> {
	// Return existing client if connected
	if (client) {
		return client;
	}

	// If connection is in progress, wait for it
	if (connectionPromise) {
		return connectionPromise;
	}

	// Start new connection
	connectionPromise = connectToBasicMemory();

	try {
		client = await connectionPromise;
		return client;
	} finally {
		connectionPromise = null;
	}
}

/**
 * Establish connection to basic-memory subprocess
 */
async function connectToBasicMemory(): Promise<Client> {
	logger.info({ cmd: config.basicMemoryCmd }, "Connecting to basic-memory");

	transport = new StdioClientTransport({
		command: config.basicMemoryCmd,
		args: ["mcp"],
	});

	const newClient = new Client({
		name: "brain",
		version: "1.0.0",
	});

	// Handle subprocess errors
	transport.onerror = (error) => {
		logger.error({ error }, "basic-memory subprocess error");
		resetConnection();
	};

	transport.onclose = () => {
		logger.warn("basic-memory subprocess closed");
		resetConnection();
	};

	await newClient.connect(transport);

	logger.info("Connected to basic-memory subprocess");
	return newClient;
}

/**
 * Reset connection state on disconnect
 */
function resetConnection(): void {
	client = null;
	transport = null;
}

/**
 * Close the basic-memory client connection gracefully
 */
export async function closeBasicMemoryClient(): Promise<void> {
	if (transport) {
		logger.info("Closing basic-memory connection");
		try {
			await transport.close();
		} catch (error) {
			logger.error({ error }, "Error closing basic-memory transport");
		}
		resetConnection();
	}
}

/**
 * Check if client is currently connected
 */
export function isConnected(): boolean {
	return client !== null;
}
