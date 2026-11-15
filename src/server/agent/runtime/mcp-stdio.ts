/** The app tools as a stdio MCP server, for agents that run outside this process (Codex). */
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { appServer } from "../tools";

await appServer.instance.connect(new StdioServerTransport());
