import { bootstrapApplication } from "@angular/platform-browser";
import { appConfig } from "./app/app.config";
import { AppComponent } from "./app/app.component";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";

if ("__TAURI_INTERNALS__" in window) {
  window.fetch = tauriFetch as unknown as typeof fetch;
}

bootstrapApplication(AppComponent, appConfig).catch((err) =>
  console.error(err),
);
