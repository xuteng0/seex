import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";
import { formatT, setCurrentLang, t, type Lang } from "./i18n";
import { installTooltips, refreshTooltip } from "./tooltip";

declare const __APP_VERSION__: string;

interface AppState {
  history: [string, string][];
  matched: [string, string][];
  keyword: string;
  nlbn_output_path: string;
  nlbn_last_result: string | null;
  nlbn_show_terminal: boolean;
  nlbn_mode: NlbnMode;
  nlbn_append: boolean;
  nlbn_library_name: string;
  nlbn_parallel: number;
  nlbn_continue_on_error: boolean;
  nlbn_overwrite: boolean;
  nlbn_project_relative: boolean;
  nlbn_running: boolean;
  npnp_output_path: string;
  npnp_last_result: string | null;
  npnp_running: boolean;
  npnp_mode: NpnpMode;
  npnp_merge: boolean;
  npnp_append: boolean;
  npnp_library_name: string;
  npnp_parallel: number;
  npnp_continue_on_error: boolean;
  npnp_lcsc_english: boolean;
  npnp_force: boolean;
  monitoring: boolean;
  history_count: number;
  matched_count: number;
  history_save_path: string;
  matched_save_path: string;
}

type ExportTool = "nlbn" | "npnp";
type ExportTarget = "altium" | "kicad";
type ExportMessageKind = "info" | "warn" | "success" | "error";

interface ExportFinishedPayload {
  tool: ExportTool;
  success: boolean;
  message: string;
}

interface ExportProgressPayload {
  tool: ExportTool;
  message: string;
  determinate: boolean;
  current: number | null;
  total: number | null;
}

interface ExportNotice {
  kind: ExportMessageKind;
  message: string;
}

interface ExportProgressState {
  determinate: boolean;
  current: number;
  total: number;
  message: string;
}

type NlbnMode = "full" | "symbol" | "footprint" | "3d";
type NpnpMode = "full" | "schlib" | "pcblib";

interface ExportCardOptions {
  tool: ExportTool;
  countId: string;
  buttonId: string;
  matchedCount: number;
  running: boolean;
  exportLabelKey: string;
  runningLabelKey: string;
  statusId: string;
  resultId: string;
  result: string | null;
}

type UpdateStatusKind = "idle" | "checking" | "available" | "current" | "installing" | "ready" | "error";

interface UpdateUiState {
  status: UpdateStatusKind;
  update: Update | null;
  messageKey: string;
  message: string;
  downloaded: number;
  total: number | null;
}

const nlbnModes: NlbnMode[] = ["full", "symbol", "footprint", "3d"];
const npnpModes: NpnpMode[] = ["full", "schlib", "pcblib"];
const exportTargetStorageKeys: Record<ExportTarget, string> = {
  altium: "seex-export-altium-enabled",
  kicad: "seex-export-kicad-enabled",
};

let showMatched = true;
let showHistory = true;
let matchQuick = true;
let matchFull = true;
let lastState: AppState | null = null;
let updateNoticeVisible = false;
let exportTargetWarningTimer: number | null = null;

const exportTargets: Record<ExportTarget, boolean> = {
  altium: true,
  kicad: true,
};

const updateUi: UpdateUiState = {
  status: "idle",
  update: null,
  messageKey: "about.updateIdle",
  message: "",
  downloaded: 0,
  total: null,
};

const exportUi: Record<ExportTool, { progress: ExportProgressState | null; notice: ExportNotice | null; resultKind: ExportMessageKind }> = {
  nlbn: { progress: null, notice: null, resultKind: "info" },
  npnp: { progress: null, notice: null, resultKind: "info" },
};

const PATTERN_QUICK = "regex:(?m)^(C\\d{3,})$";
const PATTERN_FULL = "regex:\u7f16\u53f7[\uff1a:]\\s*(C\\d+)";

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\"/g, "&quot;");
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function showMergeOverwriteModal(conflicts: string[]): Promise<boolean> {
  const modal = $("merge-overwrite-modal");
  const fileList = $("merge-overwrite-files");
  const continueButton = $("btn-merge-overwrite-continue") as HTMLButtonElement;
  const cancelButton = $("btn-merge-overwrite-cancel") as HTMLButtonElement;

  fileList.innerHTML = "";
  conflicts.forEach((file) => {
    const item = document.createElement("div");
    item.className = "modal-file-item";
    item.textContent = file;
    fileList.appendChild(item);
  });

  modal.classList.remove("hidden");
  continueButton.focus();

  return new Promise((resolve) => {
    let onContinue: () => void;
    let onCancel: () => void;
    let onOverlayClick: (event: MouseEvent) => void;
    let onKeyDown: (event: KeyboardEvent) => void;

    const close = (value: boolean) => {
      modal.classList.add("hidden");
      continueButton.removeEventListener("click", onContinue);
      cancelButton.removeEventListener("click", onCancel);
      modal.removeEventListener("click", onOverlayClick);
      document.removeEventListener("keydown", onKeyDown);
      resolve(value);
    };

    onContinue = () => close(true);
    onCancel = () => close(false);
    onOverlayClick = (event: MouseEvent) => {
      if (event.target === modal) {
        close(false);
      }
    };
    onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close(false);
      }
    };

    continueButton.addEventListener("click", onContinue);
    cancelButton.addEventListener("click", onCancel);
    modal.addEventListener("click", onOverlayClick);
    document.addEventListener("keydown", onKeyDown);
  });
}

function buildKeyword(): string {
  const parts: string[] = [];
  if (matchFull) parts.push(PATTERN_FULL);
  if (matchQuick) parts.push(PATTERN_QUICK);
  return parts.join("||");
}

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

function loadExportTargets() {
  (Object.keys(exportTargetStorageKeys) as ExportTarget[]).forEach((target) => {
    const savedValue = localStorage.getItem(exportTargetStorageKeys[target]);
    exportTargets[target] = savedValue === null ? true : savedValue !== "false";
  });

  if (!exportTargets.altium && !exportTargets.kicad) {
    exportTargets.altium = true;
    exportTargets.kicad = true;
    saveExportTargets();
  }
}

function saveExportTargets() {
  (Object.keys(exportTargetStorageKeys) as ExportTarget[]).forEach((target) => {
    localStorage.setItem(exportTargetStorageKeys[target], String(exportTargets[target]));
  });
}

function renderExportTargetUi() {
  $("btn-target-altium").classList.toggle("active", exportTargets.altium);
  $("btn-target-kicad").classList.toggle("active", exportTargets.kicad);

  document.querySelectorAll<HTMLElement>('[data-export-target="altium"]').forEach((el) => {
    el.classList.toggle("hidden", !exportTargets.altium);
  });
  document.querySelectorAll<HTMLElement>('[data-export-target="kicad"]').forEach((el) => {
    el.classList.toggle("hidden", !exportTargets.kicad);
  });
}

function renderSchematicMetadataSource(lcscEnglish: boolean) {
  $("btn-schematic-source-lcsc").classList.toggle("active", lcscEnglish);
  $("btn-schematic-source-szlcsc").classList.toggle("active", !lcscEnglish);
}

function showExportTargetWarning() {
  const warning = $("export-target-warning");
  warning.textContent = t("settings.requireOneTarget");
  warning.classList.remove("hidden");

  if (exportTargetWarningTimer !== null) {
    window.clearTimeout(exportTargetWarningTimer);
  }
  exportTargetWarningTimer = window.setTimeout(() => {
    warning.classList.add("hidden");
    exportTargetWarningTimer = null;
  }, 3000);
}

function setExportTarget(target: ExportTarget, enabled: boolean) {
  if (!enabled) {
    const otherTarget: ExportTarget = target === "altium" ? "kicad" : "altium";
    if (!exportTargets[otherTarget]) {
      showExportTargetWarning();
      return;
    }
  }

  exportTargets[target] = enabled;
  saveExportTargets();
  renderExportTargetUi();
}

function switchPage(pageName: string) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));

  const page = document.getElementById(`page-${pageName}`);
  const nav = document.querySelector(`.nav-item[data-page="${pageName}"]`);
  if (page) page.classList.add("active");
  if (nav) nav.classList.add("active");
}

function syncInputValue(id: string, serverValue: string) {
  const input = $(id) as HTMLInputElement;
  const syncedValue = input.dataset.syncedValue;

  if (syncedValue === undefined) {
    input.value = serverValue;
    input.dataset.syncedValue = serverValue;
    return;
  }

  const hasLocalDraft = input.value !== syncedValue;
  if (!hasLocalDraft || input.value === serverValue) {
    input.value = serverValue;
    input.dataset.syncedValue = serverValue;
  }
}

function toolElementId(tool: ExportTool, suffix: string): string {
  return `${tool}-${suffix}`;
}

function messageClass(kind: ExportMessageKind): string {
  switch (kind) {
    case "warn":
      return "msg-warn";
    case "success":
      return "msg-success";
    case "error":
      return "msg-error";
    default:
      return "msg-info";
  }
}

function rerenderState() {
  if (lastState) {
    renderState(lastState);
  }
}

function setExportNotice(tool: ExportTool, message: string | null, kind: ExportMessageKind = "warn") {
  exportUi[tool].notice = message ? { kind, message } : null;
  rerenderState();
}

function startExportProgress(tool: ExportTool, message: string) {
  exportUi[tool].notice = null;
  exportUi[tool].progress = {
    determinate: false,
    current: 0,
    total: 0,
    message,
  };
  exportUi[tool].resultKind = "info";
  rerenderState();
}

function updateExportProgress(payload: ExportProgressPayload) {
  exportUi[payload.tool].notice = null;
  exportUi[payload.tool].progress = {
    determinate: payload.determinate,
    current: payload.current ?? 0,
    total: payload.total ?? 0,
    message: payload.message,
  };
  rerenderState();
}

function finishExportProgress(payload: ExportFinishedPayload) {
  exportUi[payload.tool].progress = null;
  exportUi[payload.tool].notice = null;
  exportUi[payload.tool].resultKind = payload.success ? "success" : "error";
  rerenderState();
}

function renderExportProgress(tool: ExportTool, running: boolean, fallbackMessage: string) {
  const container = $(toolElementId(tool, "progress"));
  const message = $(toolElementId(tool, "progress-message"));
  const meta = $(toolElementId(tool, "progress-meta"));
  const bar = $(toolElementId(tool, "progress-bar")) as HTMLDivElement;
  const progress =
    exportUi[tool].progress ??
    (running
      ? {
          determinate: false,
          current: 0,
          total: 0,
          message: fallbackMessage,
        }
      : null);

  if (!progress) {
    container.classList.add("hidden");
    container.classList.remove("indeterminate");
    message.textContent = "";
    meta.textContent = "";
    bar.style.width = "0%";
    return;
  }

  const determinate = progress.determinate && progress.total > 0;
  const current = determinate ? Math.min(progress.current, progress.total) : 0;
  const width = determinate ? `${Math.max(8, Math.round((current / progress.total) * 100))}%` : "42%";

  container.classList.remove("hidden");
  container.classList.toggle("indeterminate", !determinate);
  message.textContent = progress.message;
  meta.textContent = determinate ? `${current}/${progress.total}` : "";
  bar.style.width = width;
}

function renderExportNotice(tool: ExportTool) {
  const status = $(toolElementId(tool, "status"));
  const notice = exportUi[tool].notice;
  if (!notice) {
    status.textContent = "";
    status.className = "msg msg-warn hidden";
    return;
  }

  status.textContent = notice.message;
  status.className = `msg ${messageClass(notice.kind)}`;
}

function renderExportResult(tool: ExportTool, result: string | null, busy: boolean) {
  const resultBox = $(toolElementId(tool, "result"));
  if (!result || busy || exportUi[tool].notice !== null) {
    resultBox.textContent = "";
    resultBox.className = "msg msg-info hidden";
    return;
  }

  resultBox.textContent = result;
  resultBox.className = `msg ${messageClass(exportUi[tool].resultKind)}`;
}

function renderExporterCard(options: ExportCardOptions) {
  $(options.countId).textContent = `${options.matchedCount} ${t("export.itemsReady")}`;

  const busy = options.running || exportUi[options.tool].progress !== null;
  const button = $(options.buttonId) as HTMLButtonElement;
  button.disabled = options.matchedCount === 0 || busy;
  button.textContent = busy ? t("export.running") : t(options.exportLabelKey);

  renderExportProgress(options.tool, busy, t(options.runningLabelKey));
  renderExportNotice(options.tool);
  renderExportResult(options.tool, options.result, busy);
}

function renderState(state: AppState) {
  const kwLabel = t("status.keyword");
  const noneLabel = t("status.none");

  $("status-keyword").textContent = `${kwLabel} ${state.keyword || noneLabel}`;
  $("status-counts").textContent = `H: ${state.history_count} | M: ${state.matched_count}`;
  $("monitor-status").textContent = `${kwLabel} ${state.keyword ? "LCSC" : noneLabel} | H: ${state.history_count} | M: ${state.matched_count}`;

  syncInputValue("nlbn-path-input", state.nlbn_output_path);
  syncInputValue("nlbn-library-name-input", state.nlbn_library_name);
  syncInputValue("nlbn-parallel-input", String(state.nlbn_parallel));
  syncInputValue("npnp-path-input", state.npnp_output_path);
  syncInputValue("npnp-library-name-input", state.npnp_library_name);
  syncInputValue("npnp-parallel-input", String(state.npnp_parallel));
  syncInputValue("history-save-path-input", state.history_save_path);
  syncInputValue("matched-save-path-input", state.matched_save_path);

  const monBtn = $("btn-toggle-monitor");
  monBtn.classList.toggle("active", state.monitoring);
  monBtn.textContent = state.monitoring ? t("monitor.monitoring") : t("monitor.paused");

  renderExporterCard({
    tool: "nlbn",
    countId: "nlbn-export-count",
    buttonId: "btn-nlbn-export",
    matchedCount: state.matched_count,
    running: state.nlbn_running,
    exportLabelKey: "export.exportNlbn",
    runningLabelKey: "export.nlbnRunning",
    statusId: "nlbn-status",
    resultId: "nlbn-result",
    result: state.nlbn_last_result,
  });

  renderExporterCard({
    tool: "npnp",
    countId: "npnp-export-count",
    buttonId: "btn-npnp-export",
    matchedCount: state.matched_count,
    running: state.npnp_running,
    exportLabelKey: "export.exportNpnp",
    runningLabelKey: "export.npnpRunning",
    statusId: "npnp-status",
    resultId: "npnp-result",
    result: state.npnp_last_result,
  });

  nlbnModes.forEach((mode) => {
    $("btn-nlbn-mode-" + mode).classList.toggle("active", state.nlbn_mode === mode);
  });

  $("btn-toggle-nlbn-append").classList.toggle("active", state.nlbn_append);
  $("btn-toggle-nlbn-continue-on-error").classList.toggle("active", state.nlbn_continue_on_error);
  $("btn-toggle-nlbn-overwrite").classList.toggle("active", state.nlbn_overwrite);
  $("btn-toggle-nlbn-project-relative").classList.toggle("active", state.nlbn_project_relative);

  npnpModes.forEach((mode) => {
    $("btn-npnp-mode-" + mode).classList.toggle("active", state.npnp_mode === mode);
  });

  $("btn-toggle-npnp-merge").classList.toggle("active", state.npnp_merge);
  $("btn-toggle-npnp-append").classList.toggle("active", state.npnp_append);
  $("btn-toggle-npnp-continue-on-error").classList.toggle("active", state.npnp_continue_on_error);
  $("btn-toggle-npnp-force").classList.toggle("active", state.npnp_force);
  renderSchematicMetadataSource(state.npnp_lcsc_english);

  const libraryInput = $("npnp-library-name-input") as HTMLInputElement;
  const libraryApply = $("btn-apply-npnp-library-name") as HTMLButtonElement;
  $("npnp-library-name-section").classList.toggle("hidden", !state.npnp_merge);
  libraryInput.disabled = !state.npnp_merge;
  libraryApply.disabled = !state.npnp_merge;

  const forceToggle = $("btn-toggle-npnp-force") as HTMLButtonElement;
  forceToggle.disabled = false;

  $("matched-count").textContent = String(state.matched_count);
  if (showMatched && state.matched.length > 0) {
    $("matched-list").classList.remove("hidden");
    $("matched-empty").classList.add("hidden");
    renderMatchedList(state.matched);
  } else if (state.matched.length === 0) {
    $("matched-list").classList.add("hidden");
    $("matched-empty").classList.remove("hidden");
  } else {
    $("matched-list").classList.add("hidden");
    $("matched-empty").classList.add("hidden");
  }

  if (state.history.length > 0) {
    $("latest-preview").classList.remove("hidden");
    $("history-waiting").classList.add("hidden");
    const [time, content] = state.history[0];
    $("latest-time").textContent = `${t("monitor.latest")} ${time}`;
    ($("latest-content") as HTMLTextAreaElement).value = content;
  } else {
    $("latest-preview").classList.add("hidden");
    $("history-waiting").classList.remove("hidden");
  }

  $("history-count-badge").textContent = String(state.history_count);
  if (showHistory && state.history.length > 0) {
    $("history-list").classList.remove("hidden");
    $("history-empty").classList.add("hidden");
    renderHistoryList(state.history);
  } else if (state.history.length === 0) {
    $("history-list").classList.add("hidden");
    $("history-empty").classList.remove("hidden");
  } else {
    $("history-list").classList.add("hidden");
    $("history-empty").classList.add("hidden");
  }
}

function renderMatchedList(items: [string, string][]) {
  const copyLabel = t("monitor.copy");
  const c = $("matched-list");
  c.innerHTML = "";
  items.forEach(([time, value], idx) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <span class="item-time">${escapeHtml(time)}</span>
      <span class="item-value">${escapeHtml(value)}</span>
      <span class="item-actions">
        <button data-copy="${escapeAttr(value)}" title="${copyLabel}">${copyLabel}</button>
        <button data-delete-matched="${idx}" title="${t("monitor.delete")}">&times;</button>
      </span>`;
    c.appendChild(row);
  });
}

function renderHistoryList(items: [string, string][]) {
  const copyLabel = t("monitor.copy");
  const c = $("history-list");
  c.innerHTML = "";
  items.forEach(([time, content], idx) => {
    const preview = content.split("\n")[0].substring(0, 80);
    const div = document.createElement("div");
    div.className = "history-item";
    div.innerHTML = `
      <div class="item-row">
        <span class="item-time">${escapeHtml(time)}</span>
        <span class="item-value">${escapeHtml(preview)}</span>
        <span class="item-actions">
          <button data-copy="${escapeAttr(content)}" title="${copyLabel}">${copyLabel}</button>
          <button data-delete-history="${idx}" title="${t("monitor.delete")}">&times;</button>
        </span>
      </div>`;
    c.appendChild(div);
  });
}

async function refreshState() {
  const state: AppState = await invoke("get_state");
  lastState = state;
  renderState(state);
}

async function selectDirectory(title: string): Promise<string | null> {
  const selected = await open({ directory: true, title });
  return typeof selected === "string" ? selected : null;
}

async function selectSaveFile(title: string, defaultPath: string | undefined): Promise<string | null> {
  const selected = await save({
    title,
    defaultPath: defaultPath && defaultPath.trim().length > 0 ? defaultPath : undefined,
    filters: [
      { name: "Text", extensions: ["txt"] },
      { name: "All files", extensions: ["*"] },
    ],
  });
  return typeof selected === "string" ? selected : null;
}

function parsePositiveIntOrFallback(value: string, fallback: number): number {
  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

let monitorSaveResultTimer: number | null = null;

function showMonitorSaveResult(message: string, kind?: ExportMessageKind) {
  const el = $("monitor-save-result");
  const resolvedKind: ExportMessageKind = kind ?? classifySaveResult(message);
  el.textContent = message;
  el.className = `msg ${messageClass(resolvedKind)}`;

  if (monitorSaveResultTimer !== null) {
    window.clearTimeout(monitorSaveResultTimer);
  }
  monitorSaveResultTimer = window.setTimeout(() => {
    el.textContent = "";
    el.className = "msg msg-info hidden";
    monitorSaveResultTimer = null;
  }, 6000);
}

function classifySaveResult(message: string): ExportMessageKind {
  const lower = message.toLowerCase();
  if (lower.startsWith("saved") || lower.startsWith("exported")) return "success";
  if (lower.includes("failed")) return "error";
  return "warn";
}

function showExportStartResult(tool: ExportTool, result: string): boolean {
  if (result === "Export started") {
    setExportNotice(tool, null);
    return true;
  }

  exportUi[tool].progress = null;
  exportUi[tool].notice = { kind: "warn", message: result };
  rerenderState();
  return false;
}

function showExportError(tool: ExportTool, error: string) {
  exportUi[tool].progress = null;
  exportUi[tool].notice = { kind: "error", message: error };
  rerenderState();
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function setUpdateState(next: Partial<UpdateUiState>) {
  Object.assign(updateUi, next);
  renderUpdateUi();
}

function updateMessage(): string {
  if (updateUi.message) return updateUi.message;
  if (updateUi.status === "available" && updateUi.update) {
    return formatT("about.updateAvailable", { version: updateUi.update.version });
  }
  return t(updateUi.messageKey);
}

function renderUpdateUi() {
  const status = $("update-status");
  const action = $("btn-check-update") as HTMLButtonElement;
  const install = $("btn-install-update") as HTMLButtonElement;
  const restart = $("btn-restart-update") as HTMLButtonElement;
  const progress = $("update-progress");
  const bar = $("update-progress-bar") as HTMLDivElement;
  const meta = $("update-progress-meta");
  const notice = $("update-notice");

  const busy = updateUi.status === "checking" || updateUi.status === "installing";
  const canInstall = updateUi.status === "available" && updateUi.update !== null;
  const canRestart = updateUi.status === "ready";
  const showProgress = updateUi.status === "installing";
  const determinate = showProgress && updateUi.total !== null && updateUi.total > 0;
  const progressWidth = determinate ? Math.max(8, Math.min(100, Math.round((updateUi.downloaded / updateUi.total!) * 100))) : 42;

  status.textContent = updateMessage();
  status.className = `update-status update-status-${updateUi.status}`;
  action.disabled = busy;
  action.textContent = updateUi.status === "checking" ? t("about.updateChecking") : t("about.checkUpdates");
  install.disabled = !canInstall || busy;
  restart.disabled = !canRestart;

  progress.classList.toggle("hidden", !showProgress);
  progress.classList.toggle("indeterminate", !determinate);
  bar.style.width = `${progressWidth}%`;
  meta.textContent =
    showProgress && updateUi.total
      ? formatT("about.updateProgress", {
          downloaded: formatBytes(updateUi.downloaded),
          total: formatBytes(updateUi.total),
        })
      : "";

  notice.classList.toggle("hidden", !updateNoticeVisible || updateUi.status !== "available");
  notice.textContent = updateUi.update ? formatT("about.updateAvailable", { version: updateUi.update.version }) : "";
}

async function checkForUpdates(showCurrent: boolean, silentFailure = false) {
  setUpdateState({
    status: "checking",
    messageKey: "about.updateChecking",
    message: "",
    downloaded: 0,
    total: null,
  });

  try {
    const update = await check();
    if (update) {
      updateNoticeVisible = true;
      setUpdateState({
        status: "available",
        update,
        messageKey: "about.updateAvailable",
      });
      return;
    }

    updateNoticeVisible = false;
    setUpdateState({
      status: showCurrent ? "current" : "idle",
      update: null,
      messageKey: showCurrent ? "about.updateCurrent" : "about.updateIdle",
    });
  } catch (error) {
    updateNoticeVisible = false;
    if (silentFailure) {
      setUpdateState({
        status: "idle",
        update: null,
        messageKey: "about.updateIdle",
        message: "",
      });
      return;
    }

    setUpdateState({
      status: "error",
      update: null,
      message: formatT("about.updateError", { error: errorMessage(error) }),
    });
  }
}

async function installUpdate() {
  if (!updateUi.update) return;

  setUpdateState({
    status: "installing",
    messageKey: "about.updateInstalling",
    message: "",
    downloaded: 0,
    total: null,
  });

  let downloaded = 0;
  await updateUi.update.downloadAndInstall((event: DownloadEvent) => {
    if (event.event === "Started") {
      downloaded = 0;
      setUpdateState({ downloaded, total: event.data.contentLength ?? null });
    } else if (event.event === "Progress") {
      downloaded += event.data.chunkLength;
      setUpdateState({ downloaded });
    } else if (event.event === "Finished") {
      setUpdateState({ downloaded: updateUi.total ?? downloaded });
    }
  });

  updateNoticeVisible = false;
  setUpdateState({
    status: "ready",
    update: null,
    messageKey: "about.updateReady",
    downloaded: 0,
    total: null,
  });
}

let pendingExportConfigWrite: Promise<void> = Promise.resolve();

function queueExportConfigWrite(operation: () => Promise<void>): Promise<void> {
  const run = pendingExportConfigWrite.then(operation, operation);
  pendingExportConfigWrite = run.catch(() => {});
  return run;
}

async function syncNlbnExportInputs() {
  const path = ($("nlbn-path-input") as HTMLInputElement).value;
  const libraryName = ($("nlbn-library-name-input") as HTMLInputElement).value;
  const parallelValue = ($("nlbn-parallel-input") as HTMLInputElement).value;
  const parallel = parsePositiveIntOrFallback(parallelValue, 4);

  await invoke("set_nlbn_path", { path });
  await invoke("set_nlbn_library_name", { libraryName });
  await invoke("set_nlbn_parallel", { parallel });
}

async function syncNpnpExportInputs() {
  const path = ($("npnp-path-input") as HTMLInputElement).value;
  const libraryName = ($("npnp-library-name-input") as HTMLInputElement).value;
  const parallelValue = ($("npnp-parallel-input") as HTMLInputElement).value;
  const parallel = parsePositiveIntOrFallback(parallelValue, 4);

  await invoke("set_npnp_path", { path });
  await invoke("set_npnp_library_name", { libraryName });
  await invoke("set_npnp_parallel", { parallel });
}

async function confirmNpnpFreshMergeOverwrite(): Promise<boolean> {
  let conflicts: string[];
  try {
    conflicts = await invoke<string[]>("npnp_fresh_merge_conflicts");
  } catch (error) {
    console.warn("npnp_fresh_merge_conflicts failed", error);
    setExportNotice("npnp", t("export.restartRequired"), "error");
    return false;
  }

  if (conflicts.length === 0) {
    return true;
  }

  return showMergeOverwriteModal(conflicts);
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

  $("btn-check-update").addEventListener("click", () => {
    void checkForUpdates(true);
  });

  $("btn-install-update").addEventListener("click", async () => {
    try {
      await installUpdate();
    } catch (error) {
      setUpdateState({
        status: "error",
        update: null,
        message: formatT("about.updateError", { error: errorMessage(error) }),
      });
    }
  });

  $("btn-restart-update").addEventListener("click", () => {
    void relaunch();
  });

  $("update-notice").addEventListener("click", () => {
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

  $("btn-target-altium").addEventListener("click", () => {
    setExportTarget("altium", !exportTargets.altium);
  });

  $("btn-target-kicad").addEventListener("click", () => {
    setExportTarget("kicad", !exportTargets.kicad);
  });

  $("btn-schematic-source-lcsc").addEventListener("click", async () => {
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_lcsc_english", { lcscEnglish: true });
      await refreshState();
    });
  });

  $("btn-schematic-source-szlcsc").addEventListener("click", async () => {
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_lcsc_english", { lcscEnglish: false });
      await refreshState();
    });
  });

  $("btn-match-quick").addEventListener("click", async () => {
    matchQuick = !matchQuick;
    $("btn-match-quick").classList.toggle("active", matchQuick);
    await invoke("set_keyword", { keyword: buildKeyword() });
    await refreshState();
  });

  $("btn-match-full").addEventListener("click", async () => {
    matchFull = !matchFull;
    $("btn-match-full").classList.toggle("active", matchFull);
    await invoke("set_keyword", { keyword: buildKeyword() });
    await refreshState();
  });

  $("btn-toggle-monitor").addEventListener("click", async () => {
    await invoke("toggle_monitoring");
    await refreshState();
  });

  $("btn-toggle-matched").addEventListener("click", () => {
    showMatched = !showMatched;
    $("btn-toggle-matched").classList.toggle("active", showMatched);
    $("btn-toggle-matched").textContent = showMatched ? t("monitor.show") : t("monitor.hide");
    void refreshState();
  });

  $("btn-copy-ids").addEventListener("click", async () => {
    const ids: string[] = await invoke("get_unique_ids");
    if (ids.length > 0) {
      await invoke("copy_to_clipboard", { text: ids.join("\n") });
    }
  });

  $("btn-nlbn-export").addEventListener("click", async () => {
    startExportProgress("nlbn", t("export.nlbnRunning"));

    try {
      await queueExportConfigWrite(async () => {
        await syncNlbnExportInputs();
        await refreshState();
      });
      const result = await invoke<string>("nlbn_export");
      showExportStartResult("nlbn", result);
      await refreshState();
    } catch (error) {
      showExportError("nlbn", errorMessage(error));
      await refreshState();
    }
  });

  $("btn-browse-nlbn-folder").addEventListener("click", async () => {
    const selected = await selectDirectory("Select nlbn export directory");
    if (selected) {
      ($("nlbn-path-input") as HTMLInputElement).value = selected;
      await queueExportConfigWrite(async () => {
        await invoke("set_nlbn_path", { path: selected });
        await refreshState();
      });
    }
  });

  $("btn-apply-nlbn-path").addEventListener("click", async () => {
    const path = ($("nlbn-path-input") as HTMLInputElement).value;
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_path", { path });
      await refreshState();
    });
  });

  nlbnModes.forEach((mode) => {
    $("btn-nlbn-mode-" + mode).addEventListener("click", async () => {
      await queueExportConfigWrite(async () => {
        await invoke("set_nlbn_mode", { mode });
        await refreshState();
      });
    });
  });

  $("btn-toggle-nlbn-append").addEventListener("click", async () => {
    const active = $("btn-toggle-nlbn-append").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_append", { append: !active });
      await refreshState();
    });
  });

  $("btn-toggle-nlbn-continue-on-error").addEventListener("click", async () => {
    const active = $("btn-toggle-nlbn-continue-on-error").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_continue_on_error", { continueOnError: !active });
      await refreshState();
    });
  });

  $("btn-toggle-nlbn-overwrite").addEventListener("click", async () => {
    const active = $("btn-toggle-nlbn-overwrite").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_overwrite", { overwrite: !active });
      await refreshState();
    });
  });

  $("btn-toggle-nlbn-project-relative").addEventListener("click", async () => {
    const active = $("btn-toggle-nlbn-project-relative").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_project_relative", { projectRelative: !active });
      await refreshState();
    });
  });

  $("btn-apply-nlbn-library-name").addEventListener("click", async () => {
    const libraryName = ($("nlbn-library-name-input") as HTMLInputElement).value;
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_library_name", { libraryName });
      await refreshState();
    });
  });

  $("btn-apply-nlbn-parallel").addEventListener("click", async () => {
    const value = ($("nlbn-parallel-input") as HTMLInputElement).value;
    const parallel = parsePositiveIntOrFallback(value, 4);
    await queueExportConfigWrite(async () => {
      await invoke("set_nlbn_parallel", { parallel });
      await refreshState();
    });
  });

  $("btn-npnp-export").addEventListener("click", async () => {
    try {
      await queueExportConfigWrite(async () => {
        await syncNpnpExportInputs();
        await refreshState();
      });
      const shouldContinue = await confirmNpnpFreshMergeOverwrite();
      if (!shouldContinue) {
        setExportNotice("npnp", t("export.cancelled"), "info");
        return;
      }

      startExportProgress("npnp", t("export.npnpRunning"));
      const result = await invoke<string>("npnp_export");
      showExportStartResult("npnp", result);
      await refreshState();
    } catch (error) {
      showExportError("npnp", errorMessage(error));
      await refreshState();
    }
  });

  $("btn-browse-npnp-folder").addEventListener("click", async () => {
    const selected = await selectDirectory("Select npnp export directory");
    if (selected) {
      ($("npnp-path-input") as HTMLInputElement).value = selected;
      await queueExportConfigWrite(async () => {
        await invoke("set_npnp_path", { path: selected });
        await refreshState();
      });
    }
  });

  $("btn-apply-npnp-path").addEventListener("click", async () => {
    const path = ($("npnp-path-input") as HTMLInputElement).value;
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_path", { path });
      await refreshState();
    });
  });

  npnpModes.forEach((mode) => {
    $("btn-npnp-mode-" + mode).addEventListener("click", async () => {
      await queueExportConfigWrite(async () => {
        await invoke("set_npnp_mode", { mode });
        await refreshState();
      });
    });
  });

  $("btn-toggle-npnp-merge").addEventListener("click", async () => {
    const active = $("btn-toggle-npnp-merge").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_merge", { merge: !active });
      await refreshState();
    });
  });

  $("btn-toggle-npnp-append").addEventListener("click", async () => {
    const active = $("btn-toggle-npnp-append").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_append", { append: !active });
      await refreshState();
    });
  });

  $("btn-toggle-npnp-continue-on-error").addEventListener("click", async () => {
    const active = $("btn-toggle-npnp-continue-on-error").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_continue_on_error", { continueOnError: !active });
      await refreshState();
    });
  });

  $("btn-toggle-npnp-force").addEventListener("click", async () => {
    const active = $("btn-toggle-npnp-force").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_force", { force: !active });
      await refreshState();
    });
  });

  $("btn-apply-npnp-library-name").addEventListener("click", async () => {
    const libraryName = ($("npnp-library-name-input") as HTMLInputElement).value;
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_library_name", { libraryName });
      await refreshState();
    });
  });

  $("btn-apply-npnp-parallel").addEventListener("click", async () => {
    const value = ($("npnp-parallel-input") as HTMLInputElement).value;
    const parallel = parsePositiveIntOrFallback(value, 4);
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_parallel", { parallel });
      await refreshState();
    });
  });

  $("btn-save-history").addEventListener("click", async () => {
    try {
      const result = await invoke<string>("save_history");
      showMonitorSaveResult(result);
    } catch (error) {
      showMonitorSaveResult(errorMessage(error), "error");
    }
  });

  $("btn-apply-history-save-path").addEventListener("click", async () => {
    const path = ($("history-save-path-input") as HTMLInputElement).value;
    await queueExportConfigWrite(async () => {
      await invoke("set_history_save_path", { path });
      await refreshState();
    });
  });

  $("btn-browse-history-save-path").addEventListener("click", async () => {
    const current = ($("history-save-path-input") as HTMLInputElement).value;
    const selected = await selectSaveFile("Choose Save History file", current);
    if (selected) {
      ($("history-save-path-input") as HTMLInputElement).value = selected;
      await queueExportConfigWrite(async () => {
        await invoke("set_history_save_path", { path: selected });
        await refreshState();
      });
    }
  });

  $("btn-apply-matched-save-path").addEventListener("click", async () => {
    const path = ($("matched-save-path-input") as HTMLInputElement).value;
    await queueExportConfigWrite(async () => {
      await invoke("set_matched_save_path", { path });
      await refreshState();
    });
  });

  $("btn-browse-matched-save-path").addEventListener("click", async () => {
    const current = ($("matched-save-path-input") as HTMLInputElement).value;
    const selected = await selectSaveFile("Choose Export Matched file", current);
    if (selected) {
      ($("matched-save-path-input") as HTMLInputElement).value = selected;
      await queueExportConfigWrite(async () => {
        await invoke("set_matched_save_path", { path: selected });
        await refreshState();
      });
    }
  });

  $("btn-save-matched").addEventListener("click", async () => {
    try {
      const result = await invoke<string>("save_matched");
      showMonitorSaveResult(result);
    } catch (error) {
      showMonitorSaveResult(errorMessage(error), "error");
    }
  });

  $("btn-clear-all").addEventListener("click", () => {
    $("btn-clear-all").classList.add("hidden");
    $("clear-confirm").classList.remove("hidden");
  });

  $("btn-clear-confirm").addEventListener("click", async () => {
    $("btn-clear-all").classList.remove("hidden");
    $("clear-confirm").classList.add("hidden");
    await invoke("clear_all");
    await refreshState();
  });

  $("btn-clear-cancel").addEventListener("click", () => {
    $("btn-clear-all").classList.remove("hidden");
    $("clear-confirm").classList.add("hidden");
  });

  showHistory = true;
  void checkForUpdates(false, true);

  document.addEventListener("click", async (e) => {
    const target = e.target as HTMLElement;

    const urlEl = target.closest("[data-url]") as HTMLElement | null;
    if (urlEl) {
      const url = urlEl.getAttribute("data-url");
      if (url) {
        await openUrl(url);
        return;
      }
    }

    const copyVal = target.getAttribute("data-copy");
    if (copyVal !== null) {
      await invoke("copy_to_clipboard", { text: copyVal });
      return;
    }

    const dm = target.getAttribute("data-delete-matched");
    if (dm !== null) {
      await invoke("delete_matched", { index: parseInt(dm, 10) });
      await refreshState();
      return;
    }

    const dh = target.getAttribute("data-delete-history");
    if (dh !== null) {
      await invoke("delete_history", { index: parseInt(dh, 10) });
      await refreshState();
    }
  });
});
