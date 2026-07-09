import { createRoot } from "react-dom/client";
import "./i18n/config";
import { bootstrapGeneratedSiteAnalytics } from "./analytics.ts";
import App from "./App.tsx";
import "./index.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container #root was not found.");
}

bootstrapGeneratedSiteAnalytics();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('Service worker registration failed:', error);
    });
  });
}

createRoot(container).render(<App />);
