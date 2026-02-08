/**
 * Express app setup.
 *
 * This file creates and configures the Express app but does NOT start
 * the server (no app.listen here). This is intentional — it lets our
 * tests import the app without it trying to bind to a port.
 *
 * The actual server start happens in index.ts.
 */

import express from "express";
import type { Database } from "bun:sqlite";
import { createOrderRoutes } from "./routes/orders";
import path from "path";

/**
 * Creates a configured Express app.
 *
 * We pass the database in as a parameter (instead of importing it globally)
 * so that tests can pass an in-memory database while production uses the
 * real file-based one. This pattern is called "dependency injection".
 *
 * @param db - SQLite database instance
 * @returns Configured Express app, ready to listen or be used in tests
 */
export function createApp(db: Database) {
  const app = express();

  // Parse JSON request bodies — without this, req.body would be undefined
  // for POST/PATCH requests that send JSON data
  app.use(express.json());

  // Health check endpoint — useful for monitoring and Docker health checks.
  // A simple "is the server alive?" check.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Mount all order CRUD routes at /api/orders
  // e.g., GET /api/orders, POST /api/orders, PATCH /api/orders/:id, etc.
  app.use("/api/orders", createOrderRoutes(db));

  // In production, serve the built React frontend as static files.
  // During development, Vite handles the frontend separately.
  if (process.env.NODE_ENV === "production") {
    const distPath = path.join(import.meta.dir, "../../dist");
    app.use(express.static(distPath));

    // For any non-API route, serve index.html (this is how SPAs work —
    // the frontend router handles all the "pages")
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  return app;
}
