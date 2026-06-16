import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open, save } from "@tauri-apps/plugin-dialog";
import { openUrl } from "@tauri-apps/plugin-opener";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

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

type Lang = "en" | "zh";
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

const enTranslations: Record<string, string> = {
  "nav.monitor": "Monitor",
  "nav.history": "History",
  "nav.export": "Export",
  "nav.settings": "Settings",
  "nav.about": "About",
  "status.listening": "Listening",
  "monitor.matchMode": "Match Mode",
  "monitor.quickId": "Quick ID",
  "monitor.fullInfo": "Full Info",
  "monitor.monitoring": "Monitoring",
  "monitor.paused": "Paused",
  "monitor.matched": "Matched",
  "monitor.copyIds": "Copy IDs",
  "monitor.show": "Show",
  "monitor.hide": "Hide",
  "monitor.noMatches": "No matches yet",
  "monitor.clipboard": "Clipboard",
  "monitor.waiting": "Waiting for clipboard...",
  "monitor.saveHistory": "Save History",
  "monitor.exportMatched": "Export Matched",
  "monitor.savePaths": "Save paths",
  "monitor.savePathsHint": "Used by Save History and Export Matched.",
  "monitor.historySavePath": "Save History file:",
  "monitor.matchedSavePath": "Export Matched file:",
  "monitor.savePathsExample": "Example: C:\\Users\\xxx\\Documents\\history.txt",
  "monitor.clearAll": "Clear All",
  "monitor.sure": "Sure?",
  "monitor.yes": "Yes",
  "monitor.no": "No",
  "monitor.latest": "Latest:",
  "monitor.copy": "Copy",
  "monitor.delete": "Delete",
  "history.desc": "Clipboard history",
  "history.entries": "entries",
  "history.empty": "No history yet",
  "export.desc": "Component export integrations",
  "export.nlbnExport": "nlbn Export",
  "export.npnpExport": "npnp Altium Designer Export",
  "export.nlbnConfig": "nlbn Configuration",
  "export.npnpConfig": "npnp Altium Designer Configuration",
  "export.nlbnMode": "Export mode:",
  "export.nlbnOptions": "Batch options:",
  "export.itemsReady": "items ready",
  "export.exportNlbn": "Export nlbn",
  "export.exportNpnp": "Export npnp",
  "export.running": "Running...",
  "export.nlbnRunning": "nlbn is running, please wait...",
  "export.npnpRunning": "npnp is running, please wait...",
  "export.mergeOverwriteTitle": "Existing merged library found",
  "export.mergeOverwriteKicker": "Overwrite warning",
  "export.mergeOverwriteBody": "Merge without Merge&Append will replace the existing merged library files below.",
  "export.mergeOverwriteAdvice": "Use Merge&Append to keep existing components and add new ones.",
  "export.continueOverwrite": "Continue",
  "export.cancel": "Cancel",
  "export.cancelled": "Export cancelled.",
  "export.restartRequired": "SeEx needs to restart before this merge safety check is available.",
  "export.exportDir": "Export directory:",
  "export.browse": "Browse",
  "export.apply": "Apply",
  "export.toggleTerminal": "Background Only",
  "export.terminalOn": "Terminal launch disabled",
  "export.terminalOff": "Terminal launch disabled",
  "export.example": "Example: C:\\Users\\xxx\\lib",
  "export.nlbnNotFound": "nlbn is not installed",
  "export.nlbnInstallHint": "Install nlbn and add it to your system PATH to use this feature.",
  "export.npnpMode": "Export mode:",
  "export.npnpOptions": "Batch options:",
  "export.full": "Full",
  "export.append": "Append",
  "export.symbol": "Symbol",
  "export.footprint": "Footprint",
  "export.model3d": "3D",
  "export.schlib": "SchLib",
  "export.pcblib": "PcbLib",
  "export.merge": "Merge",
  "export.mergeAppend": "Merge&Append",
  "export.nlbnFor": "nlbn Export for KiCad",
  "export.libraryName": "Library name:",
  "export.mergedLibraryName": "Merged library name:",
  "export.nlbnLibraryNameHint": "Optional base name for the generated KiCad library set under the export directory.",
  "export.parallel": "Parallel jobs:",
  "export.nlbnParallelHint": "nlbn requires --parallel to be at least 1.",
  "export.npnpParallelHint": "Controls npnp batch concurrency and must be at least 1.",
  "export.continueOnError": "Continue On Error",
  "export.continueOnErrorTitle": "Keep processing the remaining IDs when one item fails.",
  "export.force": "Force",
  "export.npnpForceTitle": "Regenerate existing npnp outputs and ignore completed batch checkpoint entries.",
  "export.overwrite": "Overwrite",
  "export.nlbnOverwriteTitle": "Allow nlbn to replace existing generated KiCad output files.",
  "export.projectRelative": "Project Relative",
  "export.projectRelativeTitle": "Write 3D model paths as project-relative KIPRJMOD references.",
  "export.nlbnAppendTitle": "Add exported items to an existing KiCad library set in the export directory.",
  "export.npnpMergeTitle": "Build one merged Altium SchLib/PcbLib from the current input list. Existing same-name merged files may be replaced.",
  "export.npnpMergeAppendTitle": "Append new IDs into an existing merged Altium library and skip IDs that are already present.",
  "settings.desc": "Interface and export target preferences",
  "settings.exportTargets": "Export targets",
  "settings.exportTargetsHint": "Choose which export tools appear on the Export page.",
  "settings.altium": "Altium Designer",
  "settings.kicad": "KiCad",
  "settings.requireOneTarget": "At least one export target must stay enabled.",
  "settings.performance": "Performance",
  "settings.performanceHint": "Set batch concurrency for each export tool.",
  "settings.kicadParallel": "KiCad parallel jobs:",
  "settings.altiumParallel": "Altium parallel jobs:",
  "settings.schematicSource": "Schematic metadata source",
  "settings.schematicSourceHint": "Choose where npnp reads SchLib descriptions and parameters.",
  "settings.lcscEnglish": "LCSC English",
  "settings.szlcscChinese": "SZLCSC Chinese",
  "language.desc": "Switch interface language",
  "language.select": "Select Language",
  "about.tagline": "Clipboard Event Tracker",
  "about.desc": "Monitors clipboard in real time, extracts component IDs using keyword or regex, and exports via nlbn or npnp.",
  "about.platforms": "Windows | macOS | Linux",
  "about.updates": "Updates",
  "about.currentVersion": "Current version",
  "about.checkUpdates": "Check",
  "about.installUpdate": "Install update",
  "about.restartNow": "Restart",
  "about.updateIdle": "Check GitHub Releases for a signed SeEx update.",
  "about.updateChecking": "Checking for updates...",
  "about.updateCurrent": "You are running the latest version.",
  "about.updateAvailable": "SeEx {version} is available.",
  "about.updateInstalling": "Downloading and installing update...",
  "about.updateReady": "Update installed. Restart SeEx to finish.",
  "about.updateError": "Update check failed: {error}",
  "about.updateProgress": "{downloaded} / {total}",
  "status.keyword": "Keyword:",
  "status.none": "none",
};

const zhTranslations: Record<string, string> = {
  ...enTranslations,
  "nav.monitor": "\u76d1\u542c",
  "nav.history": "\u5386\u53f2",
  "nav.export": "\u5bfc\u51fa",
  "nav.settings": "\u8bbe\u7f6e",
  "nav.about": "\u5173\u4e8e",
  "status.listening": "\u76d1\u542c\u4e2d",
  "monitor.matchMode": "\u5339\u914d\u6a21\u5f0f",
  "monitor.quickId": "\u5feb\u901f ID",
  "monitor.fullInfo": "\u5b8c\u6574\u4fe1\u606f",
  "monitor.monitoring": "\u76d1\u542c\u4e2d",
  "monitor.paused": "\u5df2\u6682\u505c",
  "monitor.matched": "\u5339\u914d\u7ed3\u679c",
  "monitor.copyIds": "\u590d\u5236 ID",
  "monitor.show": "\u663e\u793a",
  "monitor.hide": "\u9690\u85cf",
  "monitor.noMatches": "\u6682\u65e0\u5339\u914d\u7ed3\u679c",
  "monitor.clipboard": "\u526a\u8d34\u677f",
  "monitor.waiting": "\u7b49\u5f85\u526a\u8d34\u677f\u5185\u5bb9...",
  "monitor.saveHistory": "\u4fdd\u5b58\u5386\u53f2",
  "monitor.exportMatched": "\u5bfc\u51fa\u5339\u914d",
  "monitor.savePaths": "\u4fdd\u5b58\u8def\u5f84",
  "monitor.savePathsHint": "\u7531\u201c\u4fdd\u5b58\u5386\u53f2\u201d\u548c\u201c\u5bfc\u51fa\u5339\u914d\u201d\u4f7f\u7528\u3002",
  "monitor.historySavePath": "\u4fdd\u5b58\u5386\u53f2\u6587\u4ef6:",
  "monitor.matchedSavePath": "\u5bfc\u51fa\u5339\u914d\u6587\u4ef6:",
  "monitor.savePathsExample": "\u793a\u4f8b: C:\\Users\\xxx\\Documents\\history.txt",
  "monitor.clearAll": "\u6e05\u7a7a\u5168\u90e8",
  "monitor.sure": "\u786e\u5b9a\u5417\uff1f",
  "monitor.yes": "\u662f",
  "monitor.no": "\u5426",
  "monitor.latest": "\u6700\u65b0:",
  "monitor.copy": "\u590d\u5236",
  "monitor.delete": "\u5220\u9664",
  "history.desc": "\u526a\u8d34\u677f\u5386\u53f2",
  "history.entries": "\u6761",
  "history.empty": "\u6682\u65e0\u5386\u53f2\u8bb0\u5f55",
  "export.desc": "\u5143\u4ef6\u5bfc\u51fa\u96c6\u6210",
  "export.nlbnExport": "nlbn \u5bfc\u51fa",
  "export.npnpExport": "npnp Altium Designer \u5bfc\u51fa",
  "export.nlbnConfig": "nlbn \u914d\u7f6e",
  "export.npnpConfig": "npnp Altium Designer \u914d\u7f6e",
  "export.nlbnMode": "\u5bfc\u51fa\u6a21\u5f0f:",
  "export.nlbnOptions": "\u6279\u5904\u7406\u9009\u9879:",
  "export.itemsReady": "\u9879\u5f85\u5bfc\u51fa",
  "export.exportNlbn": "\u5bfc\u51fa nlbn",
  "export.exportNpnp": "\u5bfc\u51fa npnp",
  "export.running": "\u8fd0\u884c\u4e2d...",
  "export.nlbnRunning": "nlbn \u6b63\u5728\u8fd0\u884c\uff0c\u8bf7\u7a0d\u5019...",
  "export.npnpRunning": "npnp \u6b63\u5728\u8fd0\u884c\uff0c\u8bf7\u7a0d\u5019...",
  "export.mergeOverwriteTitle": "\u53d1\u73b0\u5df2\u6709\u5408\u5e76\u5e93",
  "export.mergeOverwriteKicker": "\u8986\u76d6\u63d0\u9192",
  "export.mergeOverwriteBody": "\u672a\u542f\u7528\u201c\u5408\u5e76\u8ffd\u52a0\u201d\u65f6\uff0c\u5408\u5e76\u5bfc\u51fa\u4f1a\u66ff\u6362\u4e0b\u5217\u5df2\u6709\u5e93\u6587\u4ef6\u3002",
  "export.mergeOverwriteAdvice": "\u5982\u679c\u8981\u4fdd\u7559\u65e7\u5143\u4ef6\u5e76\u6dfb\u52a0\u65b0\u5143\u4ef6\uff0c\u5efa\u8bae\u52fe\u9009\u201c\u5408\u5e76\u8ffd\u52a0\u201d\u3002",
  "export.continueOverwrite": "\u7ee7\u7eed",
  "export.cancel": "\u53d6\u6d88",
  "export.cancelled": "\u5df2\u53d6\u6d88\u5bfc\u51fa\u3002",
  "export.restartRequired": "\u9700\u8981\u91cd\u542f SeEx \u540e\u624d\u80fd\u4f7f\u7528\u5408\u5e76\u8986\u76d6\u68c0\u67e5\u3002",
  "export.exportDir": "\u5bfc\u51fa\u76ee\u5f55:",
  "export.browse": "\u6d4f\u89c8",
  "export.apply": "\u5e94\u7528",
  "export.toggleTerminal": "\u4ec5\u540e\u53f0\u8fd0\u884c",
  "export.terminalOn": "\u5df2\u7981\u7528\u7ec8\u7aef\u542f\u52a8",
  "export.terminalOff": "\u5df2\u7981\u7528\u7ec8\u7aef\u542f\u52a8",
  "export.example": "\u793a\u4f8b: C:\\Users\\xxx\\lib",
  "export.nlbnNotFound": "\u672a\u5b89\u88c5 nlbn",
  "export.nlbnInstallHint": "\u8bf7\u5148\u5b89\u88c5 nlbn\uff0c\u5e76\u5c06\u5176\u52a0\u5165\u7cfb\u7edf PATH \u540e\u518d\u4f7f\u7528\u6b64\u529f\u80fd\u3002",
  "export.npnpMode": "\u5bfc\u51fa\u6a21\u5f0f:",
  "export.npnpOptions": "\u6279\u5904\u7406\u9009\u9879:",
  "export.full": "\u5b8c\u6574",
  "export.append": "\u8ffd\u52a0",
  "export.symbol": "\u7b26\u53f7",
  "export.footprint": "\u5c01\u88c5",
  "export.model3d": "3D",
  "export.merge": "\u5408\u5e76",
  "export.mergeAppend": "\u5408\u5e76\u8ffd\u52a0",
  "export.nlbnFor": "nlbn KiCad \u5bfc\u51fa",
  "export.libraryName": "\u5e93\u540d\u79f0:",
  "export.mergedLibraryName": "\u5408\u5e76\u5e93\u540d\u79f0:",
  "export.nlbnLibraryNameHint": "\u53ef\u9009\uff0c\u7528\u4e8e\u8bbe\u5b9a\u5bfc\u51fa\u76ee\u5f55\u4e0b KiCad \u5e93\u96c6\u7684\u57fa\u7840\u540d\u79f0\u3002",
  "export.parallel": "\u5e76\u884c\u4efb\u52a1\u6570:",
  "export.nlbnParallelHint": "nlbn \u8981\u6c42 --parallel \u81f3\u5c11\u4e3a 1\u3002",
  "export.npnpParallelHint": "\u63a7\u5236 npnp \u6279\u91cf\u5bfc\u51fa\u5e76\u53d1\u6570\uff0c\u4e14\u81f3\u5c11\u4e3a 1\u3002",
  "export.continueOnError": "\u51fa\u9519\u7ee7\u7eed",
  "export.continueOnErrorTitle": "\u67d0\u4e2a\u5143\u4ef6\u5bfc\u51fa\u5931\u8d25\u65f6\uff0c\u7ee7\u7eed\u5904\u7406\u5269\u4f59 ID\u3002",
  "export.force": "\u5f3a\u5236",
  "export.npnpForceTitle": "\u91cd\u65b0\u751f\u6210\u5df2\u6709 npnp \u8f93\u51fa\uff0c\u5e76\u5ffd\u7565\u6279\u5904\u7406 checkpoint \u4e2d\u5df2\u5b8c\u6210\u7684\u9879\u76ee\u3002",
  "export.overwrite": "\u8986\u76d6",
  "export.nlbnOverwriteTitle": "\u5141\u8bb8 nlbn \u66ff\u6362\u5df2\u6709\u7684 KiCad \u751f\u6210\u6587\u4ef6\u3002",
  "export.projectRelative": "\u9879\u76ee\u76f8\u5bf9\u8def\u5f84",
  "export.projectRelativeTitle": "\u5c06 3D \u6a21\u578b\u8def\u5f84\u5199\u6210 KIPRJMOD \u98ce\u683c\u7684\u9879\u76ee\u76f8\u5bf9\u5f15\u7528\u3002",
  "export.nlbnAppendTitle": "\u5c06\u5bfc\u51fa\u5143\u4ef6\u8ffd\u52a0\u5230\u5bfc\u51fa\u76ee\u5f55\u4e0b\u5df2\u6709\u7684 KiCad \u5e93\u96c6\u3002",
  "export.npnpMergeTitle": "\u7528\u5f53\u524d\u8f93\u5165\u5217\u8868\u751f\u6210\u4e00\u4e2a\u5408\u5e76 Altium SchLib/PcbLib\uff0c\u540c\u540d\u65e7\u5408\u5e76\u5e93\u53ef\u80fd\u88ab\u66ff\u6362\u3002",
  "export.npnpMergeAppendTitle": "\u5c06\u65b0 ID \u8ffd\u52a0\u5230\u5df2\u6709\u7684\u5408\u5e76 Altium \u5e93\uff0c\u5e76\u8df3\u8fc7\u5df2\u5b58\u5728\u7684 ID\u3002",
  "settings.desc": "\u754c\u9762\u548c\u5bfc\u51fa\u76ee\u6807\u504f\u597d",
  "settings.exportTargets": "\u5bfc\u51fa\u76ee\u6807",
  "settings.exportTargetsHint": "\u9009\u62e9\u54ea\u4e9b\u5bfc\u51fa\u5de5\u5177\u663e\u793a\u5728\u5bfc\u51fa\u9875\u9762\u3002",
  "settings.altium": "Altium Designer",
  "settings.kicad": "KiCad",
  "settings.requireOneTarget": "\u81f3\u5c11\u9700\u8981\u4fdd\u7559\u4e00\u4e2a\u5bfc\u51fa\u76ee\u6807\u3002",
  "settings.performance": "\u6027\u80fd",
  "settings.performanceHint": "\u8bbe\u7f6e\u5404\u5bfc\u51fa\u5de5\u5177\u7684\u6279\u5904\u7406\u5e76\u53d1\u6570\u3002",
  "settings.kicadParallel": "KiCad \u5e76\u884c\u4efb\u52a1\u6570:",
  "settings.altiumParallel": "Altium \u5e76\u884c\u4efb\u52a1\u6570:",
  "settings.schematicSource": "\u539f\u7406\u56fe\u53c2\u6570\u6765\u6e90",
  "settings.schematicSourceHint": "\u9009\u62e9 npnp \u4ece\u54ea\u91cc\u8bfb\u53d6 SchLib \u63cf\u8ff0\u548c\u53c2\u6570\u3002",
  "settings.lcscEnglish": "LCSC \u82f1\u6587",
  "settings.szlcscChinese": "SZLCSC \u4e2d\u6587",
  "language.desc": "\u5207\u6362\u754c\u9762\u8bed\u8a00",
  "language.select": "\u9009\u62e9\u8bed\u8a00",
  "about.tagline": "\u526a\u8d34\u677f\u4e8b\u4ef6\u8ffd\u8e2a\u5668",
  "about.desc": "\u5b9e\u65f6\u76d1\u542c\u526a\u8d34\u677f\uff0c\u6309\u5173\u952e\u5b57\u6216\u6b63\u5219\u63d0\u53d6\u5143\u4ef6 ID\uff0c\u5e76\u901a\u8fc7 nlbn \u6216 npnp \u5bfc\u51fa\u3002",
  "about.platforms": "Windows | macOS | Linux",
  "about.updates": "\u66f4\u65b0",
  "about.currentVersion": "\u5f53\u524d\u7248\u672c",
  "about.checkUpdates": "\u68c0\u67e5",
  "about.installUpdate": "\u5b89\u88c5\u66f4\u65b0",
  "about.restartNow": "\u91cd\u542f",
  "about.updateIdle": "\u68c0\u67e5 GitHub Releases \u4e0a\u7684 SeEx \u7b7e\u540d\u66f4\u65b0\u3002",
  "about.updateChecking": "\u6b63\u5728\u68c0\u67e5\u66f4\u65b0...",
  "about.updateCurrent": "\u5df2\u662f\u6700\u65b0\u7248\u672c\u3002",
  "about.updateAvailable": "\u53d1\u73b0 SeEx {version}\u3002",
  "about.updateInstalling": "\u6b63\u5728\u4e0b\u8f7d\u5e76\u5b89\u88c5\u66f4\u65b0...",
  "about.updateReady": "\u66f4\u65b0\u5df2\u5b89\u88c5\uff0c\u91cd\u542f SeEx \u540e\u751f\u6548\u3002",
  "about.updateError": "\u66f4\u65b0\u68c0\u67e5\u5931\u8d25: {error}",
  "about.updateProgress": "{downloaded} / {total}",
  "status.keyword": "\u5173\u952e\u5b57:",
  "status.none": "\u65e0",
};

const translations: Record<Lang, Record<string, string>> = {
  en: enTranslations,
  zh: zhTranslations,
};

let currentLang: Lang = "en";
let showMatched = true;
let showHistory = true;
let matchQuick = true;
let matchFull = true;
let lastState: AppState | null = null;
let updateNoticeVisible = false;
let exportTargetWarningTimer: number | null = null;
let activeTooltipElement: HTMLElement | null = null;

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

function t(key: string): string {
  return translations[currentLang][key] ?? translations.en[key] ?? key;
}

function formatT(key: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [name, value]) => text.replace(new RegExp(`\\{${name}\\}`, "g"), String(value)),
    t(key),
  );
}

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

function positionTooltip(anchor: HTMLElement, clientX?: number, clientY?: number) {
  const tooltip = $("app-tooltip");
  const margin = 12;
  const gap = 10;
  const rect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const preferredX = clientX ?? rect.left + rect.width / 2;
  const preferredY = clientY ?? rect.bottom;
  let left = preferredX + gap;
  let top = preferredY + gap;

  if (left + tooltipRect.width + margin > window.innerWidth) {
    left = window.innerWidth - tooltipRect.width - margin;
  }
  if (left < margin) {
    left = margin;
  }
  if (top + tooltipRect.height + margin > window.innerHeight) {
    top = preferredY - tooltipRect.height - gap;
  }
  if (top < margin) {
    top = margin;
  }

  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
}

function showTooltip(anchor: HTMLElement, clientX?: number, clientY?: number) {
  const key = anchor.getAttribute("data-i18n-title");
  if (!key) {
    return;
  }

  const tooltip = $("app-tooltip");
  tooltip.textContent = t(key);
  tooltip.classList.remove("hidden");
  activeTooltipElement = anchor;
  positionTooltip(anchor, clientX, clientY);
}

function hideTooltip(anchor?: HTMLElement) {
  if (anchor && activeTooltipElement !== anchor) {
    return;
  }

  const tooltip = $("app-tooltip");
  tooltip.classList.add("hidden");
  tooltip.textContent = "";
  activeTooltipElement = null;
}

function installTooltips() {
  document.querySelectorAll<HTMLElement>("[data-i18n-title]").forEach((el) => {
    el.removeAttribute("title");
    if (el.dataset.tooltipBound === "true") {
      return;
    }

    el.dataset.tooltipBound = "true";
    el.addEventListener("mouseenter", (event) => {
      showTooltip(el, event.clientX, event.clientY);
    });
    el.addEventListener("mousemove", (event) => {
      if (activeTooltipElement === el) {
        positionTooltip(el, event.clientX, event.clientY);
      }
    });
    el.addEventListener("mouseleave", () => hideTooltip(el));
    el.addEventListener("focus", () => showTooltip(el));
    el.addEventListener("blur", () => hideTooltip(el));
    el.addEventListener("click", () => hideTooltip(el));
  });
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
  currentLang = lang;
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

  if (activeTooltipElement) {
    showTooltip(activeTooltipElement);
  }

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
