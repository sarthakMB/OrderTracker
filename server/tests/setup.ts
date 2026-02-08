/**
 * Test setup helper — creates a fresh app + database for each test.
 *
 * Each test gets its own in-memory SQLite database, which means:
 * - Tests are FAST (no disk I/O)
 * - Tests are ISOLATED (no leftover data between tests)
 * - Tests can run in parallel safely
 *
 * Usage in tests:
 *   let testApp: TestApp;
 *   beforeEach(async () => { testApp = await createTestApp(); });
 *   afterEach(() => { testApp.cleanup(); });
 */

import { createApp } from "../src/app";
import { createDatabase } from "../src/db/database";
import type { Server } from "http";

/** What createTestApp returns — everything you need for testing */
interface TestApp {
  /** Base URL for making requests, e.g. "http://localhost:54321" */
  baseUrl: string;
  /** The HTTP server instance */
  server: Server;
  /** Call this in afterEach to close the server and database */
  cleanup: () => void;
}

/**
 * Creates a fresh test app with an in-memory database.
 *
 * Starts Express on a random port (port 0 = OS picks one for us).
 * Returns the base URL so tests can make fetch requests to it.
 */
export async function createTestApp(): Promise<TestApp> {
  // ":memory:" = in-memory database, fresh and empty each time
  const db = createDatabase(":memory:");
  const app = createApp(db);

  return new Promise((resolve) => {
    // Port 0 tells the OS to assign a random available port
    const server = app.listen(0, () => {
      const address = server.address();
      // address can be a string or an object — we need the port from the object form
      const port = typeof address === "object" ? address?.port : 0;
      const baseUrl = `http://localhost:${port}`;

      resolve({
        baseUrl,
        server,
        cleanup: () => {
          server.close();
          db.close();
        },
      });
    });
  });
}
