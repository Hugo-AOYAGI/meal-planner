# Meal planner: design

Date: 2026-11-14. Status: approved by Hugo on 2026-11-14 (he asked for the full implementation in one go).

Lines marked **(decided)** were chosen by Hugo in conversation. Lines marked **(my call)** are the designer's choices that Hugo has not explicitly confirmed; he can overrule them. Mockups he approved are in `.superpowers/brainstorm/99246-1794661771/content/` (`shell.html` option A, `screens.html`).

## 1. Intent

The household struggles with two things: finding meal ideas, and then finding a recipe for them. Today ideas come from a list they keep, which is impractical and incomplete. They also want to eat healthier.

The app is a shared library of meals with recipes attached. It has three jobs:

1. **Recall.** Resurface meals the household likes but has not cooked in a long time.
2. **Discover.** An assistant finds new ideas and recipes, and adds recipes from pasted text, links or photos.
3. **Follow through.** Plan meals into a week, see the nutrition, and get a shopping list.

It runs on Hugo's Linux PC and is reached by a few household members over Tailscale, on desktop and on phones.

## 2. Goals, non-goals, anti-goals

**Goals**

- A meal library where each meal has zero, one or several recipes. **(decided)**
- Mix and match: a meal is either a full dish or a part (protein, starch, vegetable), and a planned slot holds one dish or several parts. **(decided)**
- Editable recipes, scaled by number of people. **(decided)**
- Deterministic nutrition per recipe from a per-ingredient table. **(decided)**
- A week planner with lunch and dinner, a draw that favours meals not cooked recently, and a shopping list summed from the week. **(decided)**
- A small chat where Claude creates and edits meals, recipes and ingredients, finds recipes on the web, and reads photos. **(decided)**
- Very low idle RAM and CPU; data survives crashes and power loss. **(decided)**
- Look and feel of c4-mapper: clean, minimal, light mode only, little UI text. **(decided)**
- Content and UI in French. **(decided for content; my call for UI labels, as shown in the approved mockups)**

**Non-goals**

- Accounts, logins, roles, multiple households. Tailscale is the gate. **(my call, heard and not objected to)**
- Dark mode, offline use, native apps, pantry inventory, prices, breakfast and snacks, translations.
- Micronutrients beyond the five values in section 6.

**Anti-goals** (failure even if it works)

- An always-running process that is heavy. Target: idle server well under 100 MB RSS, near 0% CPU.
- An agent process that stays alive between messages.
- An agent that can delete data.
- Two implementations of the same operation (one for the UI, one for the agent).
- A cluttered UI: pill tags, colour coding, explanatory copy, gradients (as in the c4-mapper design notes).

## 3. Constraints

- Single Linux machine, no cloud, no Docker. Bound to `127.0.0.1` and exposed with `tailscale serve`.
- Few users, small data (hundreds of meals).
- Code must be minimal with clean abstractions, and must use existing libraries and components instead of rewriting them. **(decided)**
- Frontend must use shadcn/ui, the Vercel AI SDK on the UI side, and existing chat components. **(decided)**

## 4. Approaches considered

1. **One Bun process, agent in-process through the Vercel AI SDK Anthropic provider.** Lightest and simplest (no subprocess), but needs an Anthropic API key billed per token.
2. **The same on Node 24 with `better-sqlite3`.** Most proven runtime; roughly 30–50 MB more idle memory (estimate) and a native addon.
3. **Agent through the Claude Agent SDK**, which spawns the Claude Code runtime. Uses the Claude login already on the PC, but Anthropic suggests about 1 GiB RAM per running agent.

**Chosen (decided):** the always-on server of approach 1, with the agent of approach 3 started only when a chat message is sent and stopped right after. Hugo accepted occasional RAM use in exchange for using the Agent SDK. Node (approach 2) is the fallback runtime if Bun proves unstable or the Agent SDK misbehaves under it.

## 5. Architecture

One repository, one package, one server process.

```
browser (React SPA) ──HTTP──> Bun + Hono
                               ├─ static files (built SPA)
                               ├─ /api/*      JSON routes ─┐
                               └─ /api/chat   ─> agent run ─┤ (tools)
                                                            v
                                                     services (domain logic)
                                                            v
                                                  Drizzle ─> SQLite file
```

**Stack**

| Part | Choice | Status |
|---|---|---|
| Runtime, server | Bun, Hono | decided (approach), my call (Hono) |
| Database | SQLite through `bun:sqlite`, `journal_mode=WAL`, `synchronous=FULL` | my call |
| Query layer, migrations | Drizzle, drizzle-kit | my call |
| Frontend | Vite, React, TypeScript strict, Tailwind v4, shadcn/ui, lucide icons | decided (shadcn), my call (rest) |
| Chat UI | shadcn chat components (`message`, `message-scroller`, `bubble`, `attachment`, prompt input, tool) with `useChat` from `@ai-sdk/react` | decided |
| Agent | `@anthropic-ai/claude-agent-sdk`, one `query()` per message | decided |
| Validation | zod schemas in a shared folder, used by routes, agent tools and the client | my call |
| Server state on the client | TanStack Query | my call |
| Tests | `bun test` on the services | my call |

**Layers.** The services are the only place with domain logic (scaling, nutrition, shopping sums, the draw, all writes). JSON routes and agent tools are thin wrappers over the same service functions with the same zod schemas. Hugo asked that Claude "interact with the app through an API"; the agent tools are that API, called in-process rather than over HTTP, which he accepted when the approach was presented.

**Suggested layout** (builder may adjust):

```
src/shared/    zod schemas and types
src/server/    db/ (schema, migrations, seed), services/, routes/, agent/, index.ts
src/client/    components/ui (shadcn), features/{week,meals,shopping,chat}, lib/
```

**Durability and operations**

- Database file in `data/`. Every write is a committed transaction; with WAL and `synchronous=FULL` a commit survives power loss.
- Nightly `VACUUM INTO` to `data/backups/`, keeping the last 7. Run by a timer inside the server process, no extra daemon. **(my call)**
- Run as a systemd user service with `Restart=on-failure` and lingering enabled. Provide the unit file and a short README section for `tailscale serve`.

## 6. Data model

All names and free text are French. Tables (builder may refine columns):

- **`ciqual_food`**: read-only reference, imported from the ANSES Ciqual table. Code, French name, group, and per 100 g: kcal, protein, carbohydrate, fat, fibre. Used only to look values up.
- **`ingredient`**: the household's ingredients, with short shopping names ("Oignons", not "Oignon, cru"). Name (unique), aisle, per-100 g values (nullable), optional `ciqual_code`, and `source`: `ciqual`, `estimated` or `manual`. Created on demand, values copied from a Ciqual food when one matches. **(my call: separate reference table)**
- **`meal`**: name, `kind` (`plat`, `proteine`, `feculent`, `legume`), `status` (`regular`, `to_try`), notes. **(decided: kinds and "à essayer")**
- **`recipe`**: belongs to one meal. Name, base servings, duration in minutes, steps (ordered text), optional source URL, position among the meal's recipes. Several recipes on a meal are alternatives. **(decided)**
- **`recipe_ingredient`**: recipe, ingredient, quantity, unit (free text such as `g`, `ml`, `gousses`, or empty for pieces), `grams` (nullable), `grams_estimated`, optional note, position.
- **`plan_slot`**: date and moment (`midi`, `soir`) as key, with servings.
- **`plan_entry`**: slot, meal, chosen recipe (nullable), position. A slot is an ordered list of any meals: the approved mockup shows a dish with a part ("Dahl + Riz") and a vegetable as the main ("Ratatouille + Œufs au plat"), so the services enforce no combination rule. Only the draw has an opinion about combinations.
- **`shopping_check`** and **`shopping_extra`**: ticked state per week and ingredient, and free lines per week.
- **`setting`**: household size (default servings), which moments the draw fills.
- **`chat_conversation`** and **`chat_message`**: the Agent SDK session id and the UI messages, so a conversation can be shown again and resumed.

**Aisles** are a fixed short list (fruits et légumes, viandes et poissons, crèmerie, épicerie, surgelés, boulangerie, boissons, autre), set when an ingredient is created. **(my call)**

**Rules**

- **Scaling.** Displayed quantity and grams = stored value × requested servings ÷ base servings. Nothing is re-estimated when scaling.
- **Nutrition per person** for a recipe = Σ(grams × value per 100 g ÷ 100) ÷ base servings, for kcal, protein, carbohydrate, fat and fibre. Lines without grams, or whose ingredient has no values, are skipped and the recipe is shown as partial. Values from `estimated` ingredients or estimated grams are marked "estimé".
- **Unit weights.** No open French dataset of unit weights was found. The agent estimates grams for piece and volume quantities when it adds a recipe, they are stored, and the user can correct them.
- **Last cooked** and **times cooked** are derived from plan entries dated today or earlier. There is no separate "mark as cooked" step. **(my call)**
- **To try.** A `to_try` meal becomes `regular` by a button on the meal; nothing is automatic. **(my call)**
- **Shopping list** for a week = the chosen recipes of that week's entries, each scaled to its slot's servings, grouped by ingredient and then by aisle. Per ingredient, quantities are summed per unit; total grams are shown when every line has grams. Entries with no recipe contribute nothing. Each item lists the meals it comes from.
- **The draw.** Fills only empty slots of the displayed week, for the moments enabled in settings, from today onward. For each slot it picks a main among dishes and proteins, weighted by time since last cooked (never-cooked regulars count as oldest; `to_try` meals get a low fixed weight). If the main is a protein it adds one starch and one vegetable the same way. No meal twice in the same week. The dice on a slot redraws that slot only. The chosen recipe defaults to the meal's first. **(decided: favour long-uncooked, empty slots only, per-slot redraw; my call: the weighting details)**

## 7. Screens

Three tabs and a chat drawer, as in the approved mockups. Phone layout: bottom tabs, chat full screen from a button. **(decided: option A)**

- **Semaine.** Seven days by lunch and dinner. Each slot shows its meal names (entries after the first prefixed with "+"), kcal per person, and a redraw icon. Empty slots show a plus that opens a meal picker. Clicking a filled slot opens a small editor (popover on desktop, bottom sheet on phone): its entries, each with a recipe selector when the meal has several and a remove button, an "add meal" picker, and a servings stepper for that slot. **(my call)** Toolbar: week navigation, a servings button, "Tirer". The servings button opens a small settings popover holding the household size and which moments the draw fills; the household size is the default for slots created afterwards and does not rewrite existing slots. **(my call)** The selected week is shared by the Semaine and Courses tabs and defaults to the current week. Below the grid: average per person per day for kcal, protein and fibre, over days that have at least one planned meal.
- **Repas.** The library as a dense list sorted by longest since last cooked, with a search field and filters (Tous, Plats, Protéines, Féculents, Légumes, À essayer). Selecting a meal opens a right drawer (bottom sheet on phone): recipes as tabs, servings stepper, nutrition, ingredients with converted weights, steps, and Modifier and Planifier. Editing a recipe happens in the same drawer as a form; each line has quantity, unit, ingredient and an optional grams field (left empty, the line is skipped in nutrition and the recipe shows as partial). Ingredients are picked with a combobox that searches the household's ingredients. Creating one, or clicking an existing ingredient in a recipe, opens a small ingredient dialog: name, aisle, the five per-100 g values, and a Ciqual search that fills the values in. There is no separate ingredients screen; the chat remains the main way recipes get complete nutrition. **(my call)** Deleting a meal or recipe is here, behind a confirmation.
- **Courses.** Same week arrows as Semaine. The list always covers every day of the selected week, including days already past; ticking handles what is already bought. **(my call: Hugo was asked whether to drop past days and did not answer, so the simpler rule stands)** The week's list grouped by aisle, tick boxes, source meals in small text, and a button to add a free line. Ticks are shared by everyone and refetched on focus and every few seconds while the tab is visible; no websockets. **(my call)**
- **Assistant.** Right drawer, 320–400 px. Messages, tool activity as one-line rows ("Recette créée · Gratin de courge"), an input with a photo/file attach button, and "Nouveau" to start a fresh conversation. Conversations are per device: the browser keeps the id of its current conversation, reloads it on open, and "Nouveau" only affects that device. A history list (past conversations, reopen or delete) was added at Hugo's request: it is shared across devices, while the current conversation stays per device. **(my call)** After the agent writes, the affected lists refresh.

**Visual system.** Port c4-mapper's tokens onto shadcn's theme variables: background `#FAFAF9`, surface `#FFFFFF`, subtle `#F4F4F2`, active `#EBEBE8`, border `#E4E4E7`, strong border `#D0D0D6`, text `#18181B`, muted `#52525B`, dim `#686871`, accent `#E15D2E` (accent text `#B8451B`). Inter for text, JetBrains Mono for micro-labels (10 px, uppercase, tracked). Radii 4 and 6 px, 1 px hairlines, `shadow-card` and `shadow-panel` as in c4-mapper. The accent is only for selection, focus rings and the active tab icon. Touch targets at least 44 px on phones. Honour `prefers-reduced-motion`.

## 8. The agent

- **Lifecycle (decided).** `POST /api/chat` starts one Agent SDK `query()` for the incoming message and streams the reply. The spawned process ends with the turn. The next message passes `resume` with the stored session id. One agent run at a time for the whole app; a second request while one is running is refused with a short "occupé" message. **(my call: the single-run limit, to cap RAM)**
- **Isolation.** Custom system prompt (string, replacing the default). `settingSources: []`, `strictMcpConfig: true`, env `CLAUDE_CODE_DISABLE_AUTO_MEMORY=1` and `ENABLE_CLAUDEAI_MCP_SERVERS=false`, so nothing from Hugo's own Claude Code setup loads. Fixed working directory under `data/` so sessions resume.
- **Tools.** Built-ins limited to `WebSearch` and `WebFetch` (`tools: ["WebSearch","WebFetch"]`). App tools defined with `tool()` and `createSdkMcpServer()`, allowed as `mcp__app__*`. `permissionMode: "dontAsk"`, never `bypassPermissions`. No file or shell access.
- **App tools** wrap services: search and read meals, recipes, ingredients and Ciqual foods; create and update meals, recipes and ingredients; read the week plan and set or clear a slot's entries. **No delete tools (decided).** Clearing a plan slot is allowed since it is trivially redone.
- **Behaviour set by the system prompt.** Write in French, briefly. When adding a recipe: reuse existing ingredients before creating new ones, look values up in Ciqual before estimating, store grams for every line, mark estimates. When asked for ideas, check the library first and propose only what is not there; add proposals as `to_try` once the user says which.
- **Photos.** The client downsizes the image before sending. The server passes it as a base64 image block using the SDK's streaming-input form (required for images). Images are not stored.
- **Bridge to `useChat` (my call).** A small hand-written adapter (about 60–80 lines) maps Agent SDK messages onto the AI SDK UI message stream with `createUIMessageStream` and `createUIMessageStreamResponse`: partial text events to `text-start` / `text-delta` / `text-end`, tool calls to `tool-input-available`, tool results to `tool-output-available`. The community package `ai-sdk-provider-claude-code` was rejected: it pins an Agent SDK about 40 releases behind, has one maintainer, and ignores AI SDK tools. This is the one place the "do not rewrite existing code" rule is knowingly bent.
- **Login and model.** Uses the Claude login already on the PC; setting `ANTHROPIC_API_KEY` in the service's environment switches to API billing with no code change. Model from an env variable, default `sonnet`. Anthropic's terms say apps built on the SDK should use API keys; a household app on the owner's own login is a grey zone that Hugo was told about.

## 9. First run

- A seed script imports Ciqual into `ciqual_food`.
- The household's existing list is brought in through the chat (pasted or photographed); the agent creates the meals and then fills in recipes for those missing one. No separate import feature. **(my call, heard and not objected to)**

## 10. To verify early (before building on them)

1. The Agent SDK called from Bun: docs list `executable: 'bun'` but do not state Bun as a supported host. If it fails, run the server on Node 24 with `better-sqlite3`; Hono and Drizzle make that a contained change.
2. That an agent run with no API key picks up the machine's Claude login, and that the process is gone after the turn (check RSS before and after).
3. That with the isolation options above, the init message lists only `WebSearch`, `WebFetch` and the app tools.
4. The licence and file format of the 2025 Ciqual edition (the 2020 edition is Licence Ouverte; fall back to it if needed).
5. The exact shadcn component names and install commands for prompt input and tool display.

## 11. Left to the builder

- Exact column types, indexes, route shapes and file names.
- Component composition, form library, and how the meal picker and ingredient combobox look, within the visual system above.
- The system prompt wording and the exact tool list granularity.
- Weighting formula of the draw, as long as it follows the rules in section 6.
- Which services get tests; at minimum scaling, nutrition, shopping sums and the draw.
