# Local Markdown references

Put the table of contents and section files in the gitignored `data/knowledge/` directory on the app host. Set `MEAL_PLANNER_KNOWLEDGE_DIR` to an absolute path to use a different directory. The service account needs read access.

```text
data/knowledge/
├── TABLE-OF-CONTENTS.md
└── sections/
    ├── bread.yeast.md
    └── bread.kneading.md
```

The table of contents goes directly into the main agent prompt. Keep it compact. Use a Markdown heading for the collection name and list the topics and chapter IDs. A chapter ID is the filename stem before the first dot. In the example, pass `chapter_id: "bread"` to browse both sections. For a small collection, chapter grouping is optional.

Each section file starts with a Markdown heading such as `# Kneading`. The stem is its stable section ID. Use letters, digits, dots, hyphens, or underscores, starting with a letter or digit. Aim for at most 1,600 tokens per file and split longer topics across sections. The app discovers files directly and uses the heading as the title.

Agents can browse titles with `search_sections`, fuzzy-search titles and body text with `search`, and fetch an exact section with `read_section`. That tool returns the Markdown and its citation destination. A link such as `[Kneading](#reference/bread.kneading)` opens `sections/bread.kneading.md` in the app.

Keep the source and section files out of Git. Existing Food Lab installations in the original download directory are discovered automatically when the default collection is absent, and historical links retain their original destination.
