# Agent SDK notes (verified 2026-11-14)

Verified with `@anthropic-ai/claude-agent-sdk@0.3.325` (bundles Claude Code 2.1.325 as a native binary
`@anthropic-ai/claude-agent-sdk-linux-x64/claude`) and `zod@4`, **hosted by Bun 1.4.4**. Works; Bun is the runtime.
`executable: 'bun'|'node'` only matters for the JS entry; with the native binary it is irrelevant, do not set it.
No `ANTHROPIC_API_KEY`: init message says `"apiKeySource":"none"` and the machine's Claude login is used.
Types are authoritative: `node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts`.

## Working option set

```ts
import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

const ping = tool("ping", "Ping", { msg: z.string().optional() },          // zod raw shape, not z.object
  async (args) => ({ content: [{ type: "text", text: "pong" }] }));
const server = createSdkMcpServer({ name: "app", tools: [ping] });          // tool name => mcp__app__ping

const q = query({
  prompt: "...",                       // string, or an AsyncIterable of SDKUserMessage (needed for images)
  options: {
    model: "sonnet",
    systemPrompt: "…",                 // string REPLACES the default prompt
    tools: ["WebSearch", "WebFetch"],  // the only built-ins
    allowedTools: ["WebSearch", "WebFetch", "mcp__app__*"],
    permissionMode: "dontAsk",
    settingSources: [], strictMcpConfig: true, includePartialMessages: true,
    mcpServers: { app: server },
    cwd,                               // fixed dir (under data/) so sessions resume
    resume: sessionId,                 // optional; omit on first message
    env: { ...process.env, CLAUDE_CODE_DISABLE_AUTO_MEMORY: "1", ENABLE_CLAUDEAI_MCP_SERVERS: "false" },
  },
});
for await (const m of q) { … }
```

## Observed messages (all carry `session_id`)

1. `{type:"system", subtype:"init", session_id, tools:["WebFetch","WebSearch","mcp__app__ping"], mcp_servers:[{name:"app",status:"connected",source:"sdk"}], model:"claude-sonnet-5-5", permissionMode:"dontAsk", apiKeySource:"none", ...}`.
   Tool list is exactly the three expected. (`slash_commands`/`skills`/`agents` arrays list Claude Code built-ins; harmless, no tool access.)
   The session id is available here already; store it on init, not only at the end.
2. `{type:"system", subtype:"status", status:"requesting"}` before each model request. Ignore.
3. `{type:"stream_event", event}` (needs `includePartialMessages`), `event` is a raw Anthropic stream event, in order:
   `message_start`, `content_block_start {index, content_block:{type:"text"|"tool_use",...}}`,
   `content_block_delta {index, delta:{type:"text_delta",text}}` (tool input: `delta:{type:"input_json_delta",partial_json}`),
   `content_block_stop {index}`, `message_delta {delta:{stop_reason}}`, `message_stop`.
   A tool_use block starts with `content_block:{type:"tool_use", id:"toolu_…", name:"mcp__app__ping", input:{}}`;
   the input arrives via `input_json_delta` (may be empty string for no-arg tools).
   `index` restarts at 0 for every assistant message (one per model request), so key blocks by (message id, index).
4. `{type:"assistant", message:{id, content:[{type:"text",text}|{type:"tool_use",id,name,input}]}, parent_tool_use_id:null}`
   Complete blocks, one `assistant` message per content block, emitted right after the matching deltas. Final `input` for tool_use is here.
5. `{type:"user", message:{role:"user", content:[{type:"tool_result", tool_use_id, content:[{type:"text",text:"pong"}]}]}, tool_use_result, tool_result_meta}`
   after the tool ran. `is_error: true` on the block when the tool failed. A tool may also be denied (not in allowedTools) as an error tool_result.
6. `{type:"rate_limit_event", ...}` ignore.
7. `{type:"result", subtype:"success"|"error_*", is_error, session_id, result:"final text", total_cost_usd, num_turns, usage, ...}`
   last message of the run. After it the iterator ends and the spawned `claude` process is gone (checked with pgrep: nothing left).

Typical turn for "say ok then call ping": init, text deltas "ok", tool_use block, tool_result user message, second model request with text deltas, result. ~4 s.

## Resume and images (verified)

- Second `query()` with `options.resume = <session_id from result/init>` remembered context ("kiwi" test). Each `query()` spawns a new process.
- Images need streaming input: `prompt: asyncGenerator` yielding
  `{type:"user", message:{role:"user", content:[{type:"text",text},{type:"image",source:{type:"base64",media_type:"image/png",data}}]}, parent_tool_use_id:null, session_id:""}`.
  The shape is accepted (the model answered about the image; my 1x1 test PNG was reported as corrupt, a real image was not tested).

## Gotchas

- `tool()` takes a zod **raw shape** (`{a: z.string()}`), and the handler must return `{content:[{type:"text",text}]}` (add `isError: true` to report failures to the model).
- Without `allowedTools` containing `mcp__app__*`, `dontAsk` denies the tools.
- Cold start of a turn is ~1-2 s before the first token.
- Two machine-level quirks seen: `rate_limit_event` messages appear in the stream; the claude.ai MCP connectors do not load thanks to `ENABLE_CLAUDEAI_MCP_SERVERS=false`.
