import { $ } from "../dom";
import { t } from "../i18n";
import type { ExportTarget } from "../types";

const exportTargetStorageKeys: Record<ExportTarget, string> = {
  altium: "seex-export-altium-enabled",
  kicad: "seex-export-kicad-enabled",
};

const exportTargets: Record<ExportTarget, boolean> = {
  altium: true,
  kicad: true,
};

let exportTargetWarningTimer: number | null = null;

export function loadExportTargets() {
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

export function renderExportTargetUi() {
  $("btn-target-altium").classList.toggle("active", exportTargets.altium);
  $("btn-target-kicad").classList.toggle("active", exportTargets.kicad);

  document.querySelectorAll<HTMLElement>('[data-export-target="altium"]').forEach((el) => {
    el.classList.toggle("hidden", !exportTargets.altium);
  });
  document.querySelectorAll<HTMLElement>('[data-export-target="kicad"]').forEach((el) => {
    el.classList.toggle("hidden", !exportTargets.kicad);
  });
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

export function bindExportTargetControls() {
  $("btn-target-altium").addEventListener("click", () => {
    setExportTarget("altium", !exportTargets.altium);
  });

  $("btn-target-kicad").addEventListener("click", () => {
    setExportTarget("kicad", !exportTargets.kicad);
  });
}
