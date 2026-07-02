import { invoke } from "@tauri-apps/api/core";
import { npnpModes } from "../constants";
import { $ } from "../dom";
import { t } from "../i18n";
import {
  parsePositiveIntOrFallback,
  queueExportConfigWrite,
  syncNpnpExportInputs,
} from "../services/export-config";
import {
  setExportNotice,
  showExportError,
  showExportStartResult,
  startExportProgress,
} from "../state/export-progress";
import { selectDirectory } from "../services/file-dialogs";
import { showMergeOverwriteModal } from "../ui/modal";

interface BindNpnpControlsOptions {
  refreshState: () => Promise<void>;
  errorMessage: (error: unknown) => string;
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

export function bindNpnpControls({ refreshState, errorMessage }: BindNpnpControlsOptions) {
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

  $("btn-toggle-npnp-use-template").addEventListener("click", async () => {
    const active = $("btn-toggle-npnp-use-template").classList.contains("active");
    await queueExportConfigWrite(async () => {
      await invoke("set_npnp_use_template", { useTemplate: !active });
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
}
