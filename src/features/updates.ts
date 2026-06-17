import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent } from "@tauri-apps/plugin-updater";
import { $ } from "../dom";
import { formatT, t } from "../i18n";
import type { UpdateUiState } from "../types";

const updateUi: UpdateUiState = {
  status: "idle",
  update: null,
  messageKey: "about.updateIdle",
  message: "",
  downloaded: 0,
  total: null,
};

let updateNoticeVisible = false;

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

export function renderUpdateUi() {
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
  const progressWidth = determinate
    ? Math.max(8, Math.min(100, Math.round((updateUi.downloaded / updateUi.total!) * 100)))
    : 42;

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

export async function checkForUpdates(showCurrent: boolean, silentFailure = false) {
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

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export function bindUpdateControls(onNoticeClick: () => void) {
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

  $("update-notice").addEventListener("click", onNoticeClick);
}

export async function openProjectUrl(url: string) {
  await openUrl(url);
}
