import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { $ } from "./dom";
import {
  exportUi,
  finishExportProgress,
  setExportRerender,
  updateExportProgress,
} from "./state/export-progress";
import { bindExportTargetControls, loadExportTargets, renderExportTargetUi } from "./features/export-targets";
import { bindMatchControls } from "./features/match";
import { bindMonitorControls } from "./features/monitor";
import { bindNlbnControls } from "./features/nlbn";
import { bindNpnpControls } from "./features/npnp";
import { setCurrentLang, t, type Lang } from "./i18n";
import { errorMessage } from "./shared/errors";
import { bindUpdateControls, checkForUpdates, renderUpdateUi } from "./features/updates";
import { installTooltips, refreshTooltip } from "./tooltip";
import type { AppState, ExportFinishedPayload, ExportProgressPayload } from "./types";
import { renderState as renderAppState } from "./ui/state";

declare const __APP_VERSION__: string;

let showMatched = true;
let showHistory = true;
let lastState: AppState | null = null;

function applyLanguage(lang: Lang) {
  setCurrentLang(lang);
  localStorage.setItem("seex-lang", lang);

  document.documentElement.classList.toggle("lang-zh", lang === "zh");
  document.documentElement.lang = lang === "zh" ? "zh-CN" : "en";

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n")!;
    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder")!;
    (el as HTMLInputElement).placeholder = t(key);
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    (el as HTMLElement).removeAttribute("title");
  });

  refreshTooltip();

  $("btn-lang-en").classList.toggle("active", lang === "en");
  $("btn-lang-zh").classList.toggle("active", lang === "zh");
  renderExportTargetUi();
  $("btn-toggle-matched").textContent = showMatched ? t("monitor.show") : t("monitor.hide");
  renderUpdateUi();
}

function switchPage(pageName: string) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const page = document.getElementById(`page-${pageName}`);
  const nav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (page) page.classList.add("active");
  if (nav) nav.classList.add("active");
}

function rerenderState() {
  if (lastState) {
    renderAppState(lastState, { exportUi, showMatched, showHistory });
  }
}

setExportRerender(rerenderState);

async function refreshState() {
  const state: AppState = await invoke("get_state");
  lastState = state;
  renderAppState(state, { exportUi, showMatched, showHistory });
}

window.addEventListener("DOMContentLoaded", async () => {
  $("about-version").textContent = `v${__APP_VERSION__}`;
  $("update-current-version").textContent = `v${__APP_VERSION__}`;
  loadExportTargets();
  installTooltips();
  renderUpdateUi();

  const savedLang = localStorage.getItem("seex-lang") as Lang | null;
  if (savedLang === "zh" || savedLang === "en") {
    applyLanguage(savedLang);
  }
  renderExportTargetUi();

  await refreshState();
  await listen("clipboard-changed", () => {
    void refreshState();
  });
  await listen<ExportProgressPayload>("export-progress", (event) => {
    updateExportProgress(event.payload);
  });
  await listen<ExportFinishedPayload>("export-finished", async (event) => {
    finishExportProgress(event.payload);
    await refreshState();
  });

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const page = item.getAttribute("data-page");
      if (page) switchPage(page);
    });
  });

  $("btn-collapse").addEventListener("click", () => {
    $("sidebar").classList.toggle("collapsed");
  });

  bindUpdateControls(() => {
    switchPage("about");
  });

  $("btn-lang-en").addEventListener("click", () => {
    applyLanguage("en");
    void refreshState();
  });

  $("btn-lang-zh").addEventListener("click", () => {
    applyLanguage("zh");
    void refreshState();
  });

  bindExportTargetControls();
  bindMatchControls(refreshState);
  bindNlbnControls({ refreshState, errorMessage });
  bindNpnpControls({ refreshState, errorMessage });
  bindMonitorControls({
    refreshState,
    errorMessage,
    getShowMatched: () => showMatched,
    setShowMatched: (nextShowMatched) => {
      showMatched = nextShowMatched;
    },
  });

  showHistory = true;
  void checkForUpdates(false, true);
});
