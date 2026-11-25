# Leftovers: design

Date: 2026-11-25. Status: draft, awaiting Hugo's approval.

Lines marked **(decided)** were chosen by Hugo in conversation. Lines marked **(my call)** are the designer's choices; he can overrule them.

## 1. Intent

The household throws food away in two ways:

1. **Cooked dishes.** They often cook 6 portions for 2 so that tired weekday evenings have something ready. The boxes go into the fridge and are forgotten. The "I can't be bothered to cook" evening is never planned; it happens on the day. **(decided)**
2. **Vegetables** that go soft before they are used.

Today the app has no idea leftovers exist: a slot cooked for 6 counts as one meal on one day, and nothing reminds anyone afterwards. The draw and the plan keep proposing new dishes as if the fridge were empty.

Success: the boxes get eaten. When someone opens the app wondering what to eat tonight, the leftovers are the first thing they see, and if they don't open it, a notification reminds them before the food turns.

## 2. Goals, non-goals, anti-goals

**Goals**

- Say, when planning a dish, how many portions are eaten now and how many are kept, with little effort. **(decided)**
- A dish remembers how many portions were kept last time and proposes it again. **(decided: option C)**
- A visible "Au frigo" list with the age of each leftover and a one-tap way to eat it tonight. **(decided: surfacing on the day, not planning ahead)**
- Easy correction of the remaining portions, because people will forget to record things. **(decided)**
- Leftovers added by hand, with a creation date and a number of portions. **(decided)**
- Push notifications. **(decided: acceptable)**
- When asked what to eat, the assistant lightly reminds the user to check what is already in the fridge, and uses what they list. **(decided)**

**Non-goals**

- A pantry or vegetable inventory. Vegetables are handled only by the assistant's reminder. **(decided)**
- Expiry dates per food type, freezer tracking. **(my call: a frozen box can be marked finished and re-added by hand when thawed)**
- Placing leftovers ahead of time in the plan automatically.

**Anti-goals**

- A cluttered slot editor. The keep counter stays out of sight until asked for or remembered. **(decided)**
- An extra mandatory step when planning a meal that is not cooked in quantity.
- Nagging: more than one notification a day, or notifications about fresh leftovers.
- Two sources of truth that drift: what the shopping list buys and what the fridge shows must come from the same numbers.

## 3. Constraints

- Existing stack: Bun, Hono, Drizzle on SQLite, React with shadcn/ui, SSE for live updates, a PWA with `public/sw.js` (production build only). See `docs/superpowers/specs/2026-11-14-meal-planner-design.md`.
- Served on `127.0.0.1` behind `tailscale serve`, which gives HTTPS, which Web Push needs.
- On iPhone, Web Push only works for the app installed on the home screen (iOS 16.4+).
- No external services beyond the browser vendors' push endpoints.
- The UI services and the assistant's tools stay one implementation.

## 4. Approaches considered

1. **The plan holds the count (chosen, decided).** Each planned dish carries a number of portions to keep. Eating leftovers is a plan entry marked as such. Shopping and nutrition follow from the plan with no extra work, in line with "last cooked" already being derived from the plan.
2. **A separate fridge list.** A standalone list of boxes, added whenever extra is cooked. More flexible for things from outside the app, but a second place to keep in sync with planning and shopping.

Manual leftovers, which Hugo wants, are added to approach 1 as fridge rows with no plan origin (see 5).

## 5. Data **(my call, shape left to the builder)**

- `plan_entry.keep` (integer, default 0): portions cooked on top of the slot's servings, to be kept. The shopping list scales the entry's recipe to `slot.servings + keep`. Nutrition per person is unchanged.
- `meal.last_keep` (integer, default 0): the `keep` last saved for that meal (including 0), used to prefill. Updated whenever an entry's `keep` is set.
- `leftover` table: `id`, `plan_entry_id` (nullable, unique, cascade delete), `meal_id` (nullable), `name` (for hand-added rows without a meal), `created_on` (date), `portions` (remaining, editable), `done_at` (nullable, set when finished or thrown away), `done_reason` (`eaten` | `thrown`, nullable).
  - A row is created or updated in the same transaction as the plan entry whenever `keep > 0`. Its `created_on` is the slot's date and its `portions` equals `keep` until someone eats from it or edits it. Setting `keep` back to 0 before the slot's date deletes the row.
  - The fridge shows rows with `done_at` null, `portions > 0` and `created_on <= today`. A dish planned for Thursday with portions to keep does not show in the fridge before Thursday.
- `plan_entry.leftover_id` (nullable): set when an entry eats from a leftover. Creating such an entry decrements `portions` by the slot's servings, never below 0; deleting it gives the portions back. Such entries do not count as "cooked" for the draw's last-cooked weighting and add nothing to the shopping list.
- When `portions` reaches 0 the row is done with reason `eaten`.
- `thrown` is recorded so a later feature could show how much was wasted. Nothing shows it in this version.
- `push_subscription` table: endpoint, keys, created_at. VAPID keys generated on first start and stored in `setting`.

## 6. Screens

### Slot editor: the keep counter **(decided: easy to summon, discreet; look is my call)**

Under each entry, nothing by default. A small icon button with a box glyph (lucide `package-plus`, muted colour, 44 px touch target) sits on the entry's row next to its recipe selector. Tapping it reveals one compact line:

```
Chili sin carne            [recette ▾] [⊞] [×]
  À garder   − 4 +   parts
```

- If the meal has a `last_keep > 0`, the line is already shown and filled when the meal is planned, with a muted "comme la dernière fois". **(decided: option C)**
- Setting it to 0 hides the line again.
- The slot's existing servings stepper stays as is: it counts the people at the table.

### Planning: "Au frigo" **(my call)**

At the top of the Planning page, above the day grid, only when the fridge is not empty. One line per leftover, oldest first:

```
AU FRIGO
Chili sin carne     4 parts · 2 j        [Ce soir]  ⋯
Dahl de lentilles   2 parts · 4 j  ⚠     [Ce soir]  ⋯
                                           + reste
```

- Age in days since `created_on`. ⚠ from 3 days, the usual advice for cooked dishes kept in the fridge. **(my call)**
- **Ce soir** places the leftover on today's dinner (or lunch before 14:00) as a leftover entry, added to the slot's entries if it already has some, and decrements the portions by the slot's servings.
- **⋯** opens a small sheet: a portions stepper (the correction for forgotten updates, saved on change), **Fini** and **Jeté** buttons.
- **+ reste** opens a small dialog: a name field with the meal picker's search (a known meal or free text), a portions stepper, and a date defaulting to today. **(decided: creation date and portions)**
- In the day grid, a leftover entry shows as "Restes · Chili sin carne".

### The quick draw "pour ce soir"

The cards dealt start with the fridge's leftovers, oldest first, as cards marked "Restes", then the usual fast meals. **(my call)**

### Notifications **(decided: allowed; schedule is my call)**

- Under Foyer settings: a "Rappels restes" switch that asks the browser for permission and subscribes this device. Each device opts in by itself.
- A server timer, like the nightly backup, runs at 17:00 local time. If at least one leftover is 2 days old or more, it sends one notification to every subscribed device: "Au frigo : chili (2 parts, 3 j), dahl (2 parts, 4 j)". Tapping it opens the Planning page.
- At most one per day. Nothing is sent when the fridge holds only fresh leftovers.
- Expired or refused subscriptions (HTTP 404 or 410 from the push service) are deleted.
- Implementation: the `web-push` npm package on the server, `push` and `notificationclick` handlers in `public/sw.js`.

## 7. The assistant

- New tools wrapping the same services: list the fridge, add a hand-made leftover, set a leftover's portions or mark it finished or thrown. Planning tools accept `keep` and `leftover_id` on entries.
- System prompt additions, in `src/server/agent/prompt.ts`:
  - When the user asks what to eat, first check the fridge tool and propose leftovers if there are any.
  - Then, in one short sentence and not every time in the same conversation, invite them to say what fresh produce they have that needs using, and favour dishes that use it. **(decided: a light reminder)**
  - Never invent an inventory, never store vegetables.

## 8. Live updates and offline

- Fridge changes emit the same SSE events as plan changes, so other phones refresh.
- The fridge needs the network, like the other tabs except Courses. **(my call)**

## 9. Left to the builder

- Exact column names, migration, route shapes, and file placement under `src/server/services/planning/` and `src/client/features/week/`.
- How `keep` travels through `applySlot` and the game's planning path.
- Tests: at minimum shopping with `keep`, leftover creation, decrement and restore, fridge visibility by date, the 17:00 selection rule, and that leftover entries don't change "last cooked".
- How to restrict "Ce soir" when today's moments are both in the past (fall back to tomorrow's lunch).
