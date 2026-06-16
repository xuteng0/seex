import { t } from "./i18n";

let activeTooltipElement: HTMLElement | null = null;

function $(id: string): HTMLElement {
  return document.getElementById(id)!;
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

export function installTooltips() {
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

export function refreshTooltip() {
  if (activeTooltipElement) {
    showTooltip(activeTooltipElement);
  }
}
