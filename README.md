# Meal planner

Small self-hosted household meal planner: meal library with recipes, week planner with a draw, shopping list, and a chat assistant (Claude Agent SDK). Bun + Hono + SQLite (Drizzle) on the server, React + Vite + Tailwind v4 + shadcn/ui on the client. Design: `docs/superpowers/specs/2026-11-14-meal-planner-design.md`.

## Install, build, seed, run

```sh
bun install
bun run build          # SPA into dist/
bun run seed:ciqual    # downloads Ciqual 2025 (Licence Ouverte) into data/ciqual/ and imports ~3,500 foods and refreshes the ingredients' detail values; idempotent
bun run start          # http://127.0.0.1:4173 (API + built SPA)
```

Development: `bun run dev` (API with watch on :4173, Vite on :5173 proxying `/api`). Checks: `bun run typecheck`, `bun run test`, `bun run check:structure`. The structure check covers source and tests; Drizzle-generated migrations are excluded. After editing `src/server/db/schema.ts`: `bun run db:generate`; migrations apply at startup.

## Run as a service

```sh
mkdir -p ~/.config/systemd/user && cp deploy/meal-planner.service ~/.config/systemd/user/
systemctl --user daemon-reload && systemctl --user enable --now meal-planner
loginctl enable-linger "$USER"
tailscale serve --bg 4173      # share over the tailnet (https)
```

## Configuration (environment)

| Variable | Default | |
|---|---|---|
| `PORT` | `4173` | server listens on `127.0.0.1` only |
| `DB_PATH` | `data/meal-planner.db` | `:memory:` for tests |
| `MEAL_PLANNER_MODEL` | `sonnet` | model of the chat agent |
| `ANTHROPIC_API_KEY` | unset | unset: the agent uses this machine's Claude login; set: API billing |

## Backups

At about 03:00 every night the server writes `data/backups/<date>.db` (`VACUUM INTO`) and keeps the last 7. Restore by stopping the service and copying a backup over `data/meal-planner.db`.
