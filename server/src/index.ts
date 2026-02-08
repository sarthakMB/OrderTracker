/**
 * Server entry point — starts the Express server.
 *
 * This is the file you run to start the backend:
 *   bun src/index.ts
 *
 * It's separate from app.ts so that tests can import the app
 * without accidentally starting a server on a port.
 */

import { createApp } from "./app";
import { createDatabase } from "./db/database";

// Read config from environment variables, with sensible defaults
const PORT = process.env.PORT || 3001;
const DB_PATH = process.env.DB_PATH || "./data/orders.db";

// Initialize the database (creates file + table if they don't exist)
const db = createDatabase(DB_PATH);

// Create the Express app and start listening
const app = createApp(db);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
});
