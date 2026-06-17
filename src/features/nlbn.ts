import { invoke } from "@tauri-apps/api/core";
import { nlbnModes } from "../constants";
import { $ } from "../dom";
import {
  parsePositiveIntOrFallback,
  queueExportConfigWrite,
  syncNlbnExportInputs,
} from "../services/export-config";
import { showExportError, showExportStartResult, startExportProgress } from "../state/export-progress";
import { selectDirectory } from "../services/file-dialogs";
import { t } from "../i18n";

interface BindNlbnControlsOptions {
  refreshState: () => Promise<void>;
  errorMessage: (error: unknown) => string;
}

export function bindNlbnControls({ refreshState, errorMessage }: BindNlbnControlsOptions) {
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
}
