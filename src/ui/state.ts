import { $, syncInputValue } from "../dom";
import { t } from "../i18n";
import { nlbnModes, npnpModes } from "../constants";
import type { AppState, ExportUiState } from "../types";
import { renderExporterCard } from "./exporter-card";
import { renderHistoryList, renderMatchedList } from "./lists";

export function renderSchematicMetadataSource(lcscEnglish: boolean) {
  $("btn-schematic-source-lcsc").classList.toggle("active", lcscEnglish);
  $("btn-schematic-source-szlcsc").classList.toggle("active", !lcscEnglish);
}

export function renderState(
  state: AppState,
  options: {
    exportUi: ExportUiState;
    showMatched: boolean;
    showHistory: boolean;
  },
) {
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

  renderExporterCard(options.exportUi, {
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

  renderExporterCard(options.exportUi, {
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
  $("btn-toggle-npnp-use-template").classList.toggle("active", state.npnp_use_template);
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
  if (options.showMatched && state.matched.length > 0) {
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
  if (options.showHistory && state.history.length > 0) {
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
