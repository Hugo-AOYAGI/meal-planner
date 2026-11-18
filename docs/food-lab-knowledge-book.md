# Local Food Lab knowledge book

Keep the book and generated reader files on the app host. The app looks for `~/Downloads/The Food Lab/agent-reader` by default. To keep the reader inside the checkout, put it under the gitignored `data/` directory and set `MEAL_PLANNER_FOOD_LAB_DIR` to its absolute path in the app service environment. The service account needs read access to the directory and a working `uv` executable. Set `MEAL_PLANNER_FOOD_LAB_UV` if the app needs a different executable path.

```text
data/food-lab/
├── The Food Lab.md                 # Optional source for rebuilding
└── agent-reader/                   # MEAL_PLANNER_FOOD_LAB_DIR
    ├── reader.py                   # Local MCP stdio server and catalog builder
    ├── TABLE-OF-CONTENTS.md         # Compact chapter list included in the system prompt
    ├── catalog.json                # Ordered section metadata
    └── sections/
        └── <section-id>.md         # One readable section per file
```

The table of contents lists each chapter’s title, ID, and section count. The catalog is an array in reading order. Each item contains `id`, `title`, `chapter_id`, `path` (an array of heading titles), and `tokens`. Split sections also have `part` and `parts`. A section opens with a Markdown heading and contains at most 1,600 tokens as measured by the builder.

Use stable IDs throughout. The catalog `id`, filename stem, and citation target must match. A chat link such as `[The Food Lab — Example](#food-lab/example-chapter.example-section)` opens `sections/example-chapter.example-section.md`. The MCP reader exposes `search_sections` for browsing and title search, `search` for fuzzy keyword search, and `read_section` for loading one section by ID.

To rebuild from a local Markdown source, run this from the reader directory.

```sh
uv run reader.py --build '../The Food Lab.md'
```

Keep the source and generated reader bundle out of Git. This repository tracks the app integration and the format documentation.
