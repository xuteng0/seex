import { $ } from "../dom";

export function showMergeOverwriteModal(conflicts: string[]): Promise<boolean> {
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
