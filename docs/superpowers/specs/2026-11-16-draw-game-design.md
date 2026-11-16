# Tirage en jeu : design

Date: 2026-11-16. Status: draft, awaiting Hugo's approval.

Lines marked **(decided)** were chosen by Hugo in conversation. Lines marked **(my call)** are the designer's choices that Hugo has not explicitly confirmed; he can overrule them. Mockups shown during the conversation are in `.superpowers/brainstorm/1184556-1794864591/content/` (`concepts.html`, then `draft-variants.html`, variant D2 picked).

## 1. Intent

The "Tirer" flow (`src/client/features/week/draw/`) proposes meals for empty slots. Today it is a settings form: a duration slider, moment toggles, a filter, then "Proposer", then locks and "Relancer". It does not make anyone want to use it, and it has rough edges:

- Opening "Tirer" shows settings, not meals; you must click "Proposer" first.
- Days with nothing to propose still show rows reading "Aucune proposition".
- Changing the duration (or moments, or filter) throws the whole list away (`discard()` in `use-draw-session.ts`).

How it is used: a 30-second moment, usually by the two members of the household together, to plan the next days. **(decided)** They re-roll when a proposal feels like too much effort or does not inspire them. Their recurring problems: not inspired, dish too hard, they disagree, ingredients missing, and on the evening itself no will to shop. **(decided)**

The redesign turns the draw into a short card game for two players, each on their own phone (or passing one phone), where meals only enter the plan when both said yes. It keeps a solo mode, and adds a quick mode for one fast meal tonight. The assistant prepares new-dish cards and missing durations in the background so the game itself stays instant.

## 2. Goals, non-goals, anti-goals

**Goals**

- Tapping "Tirer" deals cards immediately; no settings screen first. **(decided)**
- Only slots that will be filled are shown; never an "Aucune proposition" row. **(decided)**
- Changing the duration while cards are dealt adapts the hand and the result instead of clearing them. **(decided)** The same applies to moments and the filter. **(my call)**
- Two-player game, rules in section 4 (D2 + catch-up round). **(decided)**
- Solo mode when the other person is not available. **(decided)**
- A "✨ Nouveau" card per hand: a dish never made, shown face up (not a mystery). **(decided)** Source: library first, assistant when the library runs out (section 6). **(decided)**
- A dedicated quick mode: draw one fast meal for tonight. **(decided)** No "express" special card in the regular hand. **(decided)**
- Game state is held by the server in memory, synced over the existing SSE stream. **(decided: approach A)**

**Non-goals**

- Accounts, logins or authentication. Players are named household members, picked per device (section 5).
- A fridge/pantry inventory. "What's in the fridge" stays a chat conversation with the assistant.
- Games that wait for hours for the other player. A duo game is live; solo is the way out. **(my call, following "oui un mode solo")**
- Surviving a server restart mid-game. **(decided, trade-off of approach A)**
- More than two players being designed for explicitly. The rules should not break with three, but nothing is tuned for it. **(my call)**

**Anti-goals** (failure even if it works)

- The game takes noticeably longer than 30 seconds for a normal 3–7 day draw.
- Waiting on the assistant during a game.
- A meal enters the plan in a duo game without both players having said yes to it.
- The draw overwrites plan changes made meanwhile (today's `expected` check in `applySuggestions` must keep holding).

## 3. Approaches considered

- **A. Server-held game in memory (picked).** The server keeps each game's state (hand, secret picks, phase) and forgets it after ~30 min idle. Phones follow it through `/api/events` with a new event type. A sleeping phone gets the state back on wake. Secret picks stay on the server until the reveal. Cost: a restart loses a running game.
- **B. Same, persisted in SQLite.** Survives restarts; needs a table and migration for state that lives a minute. Rejected as heavier for little gain.
- **C. State on the host phone, server only relays.** Least server work, but the game dies if the host phone sleeps or closes the app, which is the common case with two phones. Rejected.

Also considered at the concept stage and not picked: swipe "Match" (A), mood tokens + reels + jokers (B), a fridge-based "Ce soir" mode (C), and draft variants D1 (turn by turn), D3 ("je coupe, tu choisis"), D4 (booster with special cards). D2 was picked; from D4 only a visible "Nouveau" card survived.

## 4. Game rules

### Setup

- "Tirer" (Planning toolbar) starts a game and deals at once with defaults: 7 days from the first planned day, moments from settings (`drawMoments`), filter "Tous". **(decided: deal on tap; my call: defaults identical to today)**
- The controls (duration, moments, filter) stay available above the hand, compact (e.g. a "7 jours · Soir" chip that opens them). **(my call)**
- Slots to fill = slots in range, from today, for the selected moments, that are empty (or, for the one-day redraw from a slot, that slot). Slots with nothing to fill are not shown and get no cards. **(decided)**
- Hand size: about 2 cards per slot to fill, so each player has a real choice; the exact ratio and a cap (e.g. 14) are the builder's. **(my call)**
- Cards are drawn with the existing engine (`drawMeals` + `createBalance` bias, no repeats of meals eaten last week or planned in range). A card can be a composed main (protein + starch + vegetable), as today. **(my call)**
- One card per hand is "✨ Nouveau" when stock exists (section 6). **(decided)**

### Duo (D2 + catch-up) **(decided)**

1. **Secret round.** Each player picks, on their own screen, as many cards as there are slots to fill. They see that the other is picking / done ("Léa a fini ⏳") but not what.
2. **Reveal.** Cards picked by both are 💥 matches.
3. **Catch-up round.** Each player sees the other's unmatched picks and answers Oui / Non to each. A Oui makes a match. Everything in the plan has therefore been accepted by both.
4. **Remaining slots.** If slots are still empty, a mini-hand is dealt only for them, excluding every card already refused, and steps 1–3 repeat on it. **(decided)** "Refused" means a Non in catch-up; cards nobody picked are only left out of the very next mini-hand, so a 63-meal library does not run dry. **(my call)** A "Finir avec ce qu'on a" button is always there from the second round on, so the loop never holds the game hostage. **(my call)** If the library is exhausted, the game ends with what it has and says so plainly. **(my call)**
5. **More matches than slots.** The app keeps the matches that balance protein and fibre best; the others go to a household "envies communes" reserve with a 💛 badge. No extra step. **(decided)** The reserve is capped in size (my call: 6, oldest dropped first) and only its best few enter a hand, so it never takes over the draw (my call: at most 2 per hand, never more than a quarter of it; "best" = still eligible under the no-repeat rules, then oldest in the reserve). **(decided: capped, only the best few per hand)** A reserve card that is picked leaves the reserve. **(my call)**
6. **Placement.** Matches are assigned to slots by the app, balancing protein and fibre like the current draw. **(my call)** Players can still reorder (drag / arrows, as today) before validating. Validating writes through `applySuggestions` (all or none, `expected` check).
- Who validates: either player; the other sees the result. **(my call)**

### Solo **(decided)**

- If nobody joins, the starter picks as many cards as slots, and they go straight to placement. No reveal, no catch-up.
- While alone, the starter sees "En attente de Léa… · Jouer seul". Solo is an explicit tap (on "Jouer seul", or "Valider" once picks are done); until then the game stays open to a join. **(my call)**
- If the other player joins before the starter validates, the game becomes duo: the starter's picks become their secret picks, the joiner plays the secret round on the same hand, then reveal and catch-up as usual. **(my call)**
- "Tout relancer" deals a new hand; a single card can be swapped. **(my call)**

### Changing options mid-game **(decided for duration; my call for the rest)**

- Duration up: new slots get added; cards are added to the hand for them; existing cards and picks stay.
- Duration down: slots beyond the new end disappear; picks on cards no longer needed stay picked (the player may now have too many and must drop some) or are trimmed: builder's call, but never a silent full reset.
- Moments or filter change: adapt the same way (slots added/removed; cards no longer matching the filter are removed, new ones dealt).
- In a duo game either player can change options; the other sees a short notice. During the secret round the change applies directly. After the reveal, added slots are filled through a mini-hand (step 4) and removed slots drop their least recent match. **(my call)**

### The dice on a slot

- The dice acts on **one slot**, not a whole day. **(decided)** `SlotCard` therefore needs to know which slot (or show one dice per slot); `DayEditor` already passes one moment.
- It is **not** the duo game: it opens a small fan of 3 cards for that slot (one 💛 reserve card among them when the reserve has an eligible one). Tapping a card writes it to the slot, replacing the main and keeping starter and dessert as today; a "↻" deals 3 new cards. Solo only, no invitation. **(decided: option 2)**

### 🌙 Quick mode **(decided: a dedicated mode, one meal; my call: rules)**

- Entry: a separate button next to "Tirer" (or inside it as a mode), labelled e.g. "Un repas rapide".
- One slot: tonight's dinner (or the next meal slot of today if dinner is past or filled; builder's call).
- Hand: ~4 cards, only meals whose recipe `durationMin` ≤ a threshold (my call: 25 min, adjustable later in settings). A card's duration is its default (first) recipe's; for a composed card (protein + starch + vegetable) it is the longest part, since parts cook in parallel; a part without a duration excludes the card. **(my call)** Same duo/solo rules, with one pick each.
- 59 of the 63 current recipes already have `durationMin`. Missing ones are filled in by the assistant in the background (section 6); until then they are simply excluded from quick mode.

## 5. Players and devices

- **Members.** The household declares its members in the Foyer settings: first name and colour. Stored in the `setting` table (no new table needed). **(my call)**
- **"C'est moi."** Each device remembers which member it is, in `localStorage`, asked once at first game. **(my call)**
- **Invitation.** When a game starts, other devices see a banner "Hugo a lancé un tirage · Rejoindre" (via SSE). Joining picks the member not yet in the game. **(my call)**
- **Same phone.** A "À deux sur ce téléphone" option runs the secret round as pass-the-phone: player 1 picks, a screen "Au tour de Léa, ne regarde pas 🙈", player 2 picks. Catch-up and reveal shown on the one screen. **(my call, presented and not objected to)**
- One game at a time for the household. Starting one while another runs offers to join it instead. **(my call)**

## 6. The assistant

- **Duration estimates.** A background job asks the assistant to fill `recipe.durationMin` for recipes that lack it, from their steps. It runs after a recipe is created/edited without a duration, and once for the backlog. **(my call)**
- **"✨ Nouveau" stock.** Source order **(decided)**: (1) library meals with status `to_try`, (2) library meals never cooked, (3) assistant-prepared ideas. Today the library has 0 `to_try` meals, so (3) matters from day one.
- **Assistant-prepared ideas.** When the stock of unplayed new ideas falls below ~3, a background job asks the assistant for a few new dishes that fit the household preferences (`preference` table) and are not in the library, with a full recipe (web or adapted). **(my call)** They are stored as meals in a pending state that does not show in the library (a new status, e.g. `idea`). Taken in a game: they become `to_try` and get planned. Refused by both: they are dropped after N refusals. **(my call)**
- **Runtime constraint.** The app allows one agent run at a time (chat), and a busy agent answers the chat with 409. To avoid cancelling a job halfway (half-created meals), background jobs run at night next to the 03:00 backup, and on demand only when no chat run is active; a job that is running when a chat message arrives finishes first. They must never block a game. **(my call)** If no assistant is configured, the Nouveau card falls back to (1)–(2) only, and quick mode to recipes that already have a duration. **(my call)**
- The game never waits on the assistant. **(decided via anti-goal)**
- The assistant's existing tools (`suggest_meals`, `draw_week`, `redraw_slot`) keep working. The quick "what can we make tonight with what we have" stays a chat conversation. **(decided)**

## 7. Screens (to refine in mockups during build)

- **Hand**, phone first: a compact header (players + their status, the duration/moments chip), the cards in a 2-column grid, each card coloured as today (`colorOf`), name, duration, a ✨ badge for Nouveau. Tapping toggles a pick; a counter "2 / 3".
- **Reveal**: matches pop into place with a short animation (respect `prefers-reduced-motion`).
- **Catch-up**: the other player's unmatched picks as cards with Oui / Non.
- **Result**: only filled slots, day by day, reorderable, "Ajouter au planning".
- The UI stays in French and follows the current visual system (`index.css` tokens: sun, tomato, leaf, sky, lilac, rose; Bricolage Grotesque).
- The fun comes from speed, the reveal moment and the match feedback, not from long animations. **(decided: "petit plaisir en 30 s")**

## 8. Technical shape

- **Game service** (server, new, e.g. `src/server/services/planning/draw-game.ts`): an in-memory map of games, each with id, players, options, slots, hand, picks per player, phase (`picking` → `reveal` → `catchup` → `placing` → `done`), refused cards, matches, last activity. Pure transitions are unit-tested; dealing reuses `suggestMeals`/`drawMeals` and placement reuses the balance bias.
- **Routes** (`src/server/routes/plan.ts` or a new `draw-game` route): start, join, get state (filtered per player: no peeking at the other's secret picks before reveal), pick/unpick, change options, catch-up answer, swap/reorder, validate, leave.
- **Events.** `src/server/events.ts` gains a second event type (e.g. `draw`) carrying the game id, so clients refetch the game state without the global `invalidate.all` that `changed` triggers.
- **Expiry.** Games idle for ~30 min are dropped. **(decided as part of A)**
- **Client.** Replaces `DrawDialog` / `use-draw-session` / `SuggestionCards` internals for the big draw (Planning toolbar). The dice on a slot becomes a separate, lighter component (the 3-card fan) that only needs the existing suggestion endpoint, not the game service.
- **Reserve.** Stored in the `setting` table as a short list of meal ids with the date added (no new table). **(my call)**
- **Data changes.** Members list in settings; a meal status for pending ideas; possibly a quick-mode threshold setting. One migration at most.
- **Tests.** At least: game transitions (duo, solo, catch-up, mini-hand, options change adapting), per-player state filtering, quick-mode filtering, and that validation still refuses a changed plan.

## 9. Delivery order **(my call)**

1. The game: duo, solo, same phone, polish items, quick mode on existing durations, Nouveau card from the library only.
2. The assistant: duration backlog job, assistant-prepared ideas (`idea` status), nightly jobs.

Each phase is usable on its own.

## 10. Left to the builder

- Exact hand ratio and cap, mini-hand size.
- How a duration decrease trims picks (never a full reset).
- Exact animations, card layout details, copy.
- Which slot quick mode targets when tonight's dinner is filled or past.
- Number of refusals before an assistant idea is dropped; the stock threshold.
- The prompt used for background assistant jobs, and whether they use Claude or Codex (follow the household's chosen assistant).
