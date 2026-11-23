import { homedir } from "node:os";
import { join } from "node:path";

export const HAWK_API_URL =
  process.env.HAWK_API_URL ?? "https://api.hawk.so/graphql";

export const SESSION_STORE_PATH =
  process.env.HAWK_MCP_SESSION_STORE_PATH ??
  join(homedir(), ".hawk-mcp", "session.json");

export const MCP_TRANSPORT =
  process.env.HAWK_MCP_TRANSPORT === "httpStream" ? "httpStream" : "stdio";

export const MCP_HOST = process.env.HAWK_MCP_HOST ?? "127.0.0.1";

export const MCP_PORT = Number.parseInt(
  process.env.HAWK_MCP_PORT ?? "3000",
  10,
);

export const MCP_ENDPOINT = process.env.HAWK_MCP_ENDPOINT ?? "/mcp";
export const MCP_HTTP_AUTH_TOKEN = process.env.HAWK_MCP_HTTP_AUTH_TOKEN;

export const HAWK_REQUEST_TIMEOUT_MS = Number.parseInt(
  process.env.HAWK_REQUEST_TIMEOUT_MS ?? "15000",
  10,
);
