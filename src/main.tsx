import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { Toaster } from "@/components/ui/sonner";

/**
 * This is the entry point of the app — where React mounts to the DOM.
 *
 * StrictMode is a development-only wrapper that warns about potential
 * problems in your code (like missing cleanup in useEffect).
 *
 * Toaster (from sonner) renders toast notifications at the bottom-right
 * of the screen. It lives here so it's available app-wide.
 */
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <Toaster />
  </StrictMode>
);
