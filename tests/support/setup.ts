// A bare `bun test` must never open the live database.
process.env.DB_PATH = ":memory:";
