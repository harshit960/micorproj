import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { DataProvider } from "./lib/data.tsx";
import { registerPWA } from "./lib/pwa.ts";
import { applyTheme } from "./lib/prefs.ts";

applyTheme();
registerPWA();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DataProvider>
      <App />
    </DataProvider>
  </StrictMode>,
);
