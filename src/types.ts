import type { Update } from "@tauri-apps/plugin-updater";

export interface AppState {
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
  npnp_use_template: boolean;
  npnp_force: boolean;
  monitoring: boolean;
  history_count: number;
  matched_count: number;
  history_save_path: string;
  matched_save_path: string;
}

export type ExportTool = "nlbn" | "npnp";
export type ExportTarget = "altium" | "kicad";
export type ExportMessageKind = "info" | "warn" | "success" | "error";

export interface ExportFinishedPayload {
  tool: ExportTool;
  success: boolean;
  message: string;
}

export interface ExportProgressPayload {
  tool: ExportTool;
  message: string;
  determinate: boolean;
  current: number | null;
  total: number | null;
}

export interface ExportNotice {
  kind: ExportMessageKind;
  message: string;
}

export interface ExportProgressState {
  determinate: boolean;
  current: number;
  total: number;
  message: string;
}

export type ExportUiState = Record<
  ExportTool,
  { progress: ExportProgressState | null; notice: ExportNotice | null; resultKind: ExportMessageKind }
>;

export type NlbnMode = "full" | "symbol" | "footprint" | "3d";
export type NpnpMode = "full" | "schlib" | "pcblib";

export interface ExportCardOptions {
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

export type UpdateStatusKind =
  | "idle"
  | "checking"
  | "available"
  | "current"
  | "installing"
  | "ready"
  | "error";

export interface UpdateUiState {
  status: UpdateStatusKind;
  update: Update | null;
  messageKey: string;
  message: string;
  downloaded: number;
  total: number | null;
}
