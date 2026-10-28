import type { FocusEvent, KeyboardEvent, PointerEvent } from "react";

type FormKeyboardContainer = HTMLElement;
type NativeSelectState = "open" | "selected";

const fieldSelector = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]):not([type="hidden"]):not([type="image"])',
  "select:not([multiple])",
  "textarea",
  'button[data-picker]:not(:disabled)',
  'button[data-entry-field]:not(:disabled)',
  '[role="combobox"][tabindex]:not([tabindex="-1"])',
].join(", ");

const selectStates = new WeakMap<HTMLSelectElement, NativeSelectState>();
const selectChangeListeners = new WeakSet<HTMLSelectElement>();
const pointerFocusedContainers = new WeakSet<FormKeyboardContainer>();
const lastActionSelector = 'button[type="submit"]:not(:disabled), input[type="submit"]:not(:disabled), [data-wizard-next]:not([disabled])';

function eligibleFields(container: FormKeyboardContainer) {
  return Array.from(container.querySelectorAll<HTMLElement>(fieldSelector)).filter((field) => {
    const control = field as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | HTMLButtonElement;
    if (control.disabled || field.getAttribute("aria-disabled") === "true") return false;
    if (field.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    if (!field.getClientRects().length) return false;
    return window.getComputedStyle(field).visibility !== "hidden";
  });
}

function trackNativeSelect(select: HTMLSelectElement) {
  if (selectChangeListeners.has(select)) return;
  select.addEventListener("change", () => {
    if (selectStates.get(select) === "open") selectStates.set(select, "selected");
  });
  select.addEventListener("blur", () => selectStates.delete(select));
  selectChangeListeners.add(select);
}

function armNativeSelect(select: HTMLSelectElement) {
  if (select.disabled || select.multiple || select.size > 1 || selectStates.get(select) === "open") return;
  trackNativeSelect(select);
  // Keep Enter's first press for accepting the native value even if showPicker
  // is missing or the browser requires a stronger user gesture.
  selectStates.set(select, "open");
  if (typeof select.showPicker !== "function") return;

  try {
    select.showPicker();
  } catch {
    // The select remains usable with its standard arrow-key behavior.
  }
}

function firstVisibleAction(container: FormKeyboardContainer) {
  return Array.from(container.querySelectorAll<HTMLElement>(lastActionSelector)).find((action) => {
    if ((action as HTMLButtonElement).disabled || action.getAttribute("aria-disabled") === "true") return false;
    if (action.closest("[hidden], [inert], [aria-hidden='true']")) return false;
    if (!action.getClientRects().length) return false;
    return window.getComputedStyle(action).visibility !== "hidden";
  });
}

function findLastAction(container: FormKeyboardContainer) {
  return firstVisibleAction(container)
    ?? (container.parentElement ? firstVisibleAction(container.parentElement) : undefined);
}

function focusField(field: HTMLElement) {
  field.focus();
  if (field instanceof HTMLInputElement
    && ["text", "search", "tel", "url", "email", "password"].includes(field.type)) field.select();
  if (field instanceof HTMLSelectElement) armNativeSelect(field);
}

export function focusFormKeyboardField(field: HTMLElement | null) {
  if (field) focusField(field);
}

function focusNextField(container: FormKeyboardContainer, fields: HTMLElement[], index: number) {
  const next = fields[index + 1];
  if (next) {
    focusField(next);
    return;
  }

  findLastAction(container)?.focus();
}

/** Open native selects when they receive keyboard focus inside an entry surface. */
export function handleFormKeyboardFocus(event: FocusEvent<FormKeyboardContainer>) {
  if (pointerFocusedContainers.has(event.currentTarget)) return;
  if (event.target instanceof HTMLSelectElement) armNativeSelect(event.target);
}

/** Let a pointer click use the browser's normal select opening behavior. */
export function handleFormKeyboardPointerDown(event: PointerEvent<FormKeyboardContainer>) {
  const container = event.currentTarget;
  pointerFocusedContainers.add(container);
  window.setTimeout(() => pointerFocusedContainers.delete(container), 0);

  container.querySelectorAll("select").forEach((select) => selectStates.delete(select));

  if (event.target instanceof Element) {
    const select = event.target.closest("select");
    if (select instanceof HTMLSelectElement && !select.multiple && select.size <= 1 && !select.disabled) {
      trackNativeSelect(select);
      selectStates.set(select, "open");
    }
  }
}

/**
 * Move Enter through the editable fields in a form or wizard section.
 * A focused native select gets one Enter to accept its highlighted option;
 * the next Enter advances to the next field.
 */
export function handleFormEnterNavigation(
  event: KeyboardEvent<FormKeyboardContainer>,
  container: FormKeyboardContainer = event.currentTarget,
) {
  if (event.key === "Escape" && event.target instanceof HTMLSelectElement) {
    selectStates.delete(event.target);
    return false;
  }
  if (event.defaultPrevented || event.key !== "Enter" || event.nativeEvent.isComposing || event.repeat) return false;
  if (!(event.target instanceof HTMLElement) || !container.contains(event.target)) return false;

  const target = event.target;
  if (target instanceof HTMLTextAreaElement || target.isContentEditable || target.closest("button")) return false;
  if (target instanceof HTMLInputElement
    && ["button", "submit", "reset", "checkbox", "radio", "file", "hidden", "image"].includes(target.type)) {
    return false;
  }

  if (target instanceof HTMLSelectElement) {
    if (target.multiple || target.size > 1) return false;
    const state = selectStates.get(target);
    if (state !== "selected") {
      // Keep Enter's native behavior so it confirms the highlighted option.
      trackNativeSelect(target);
      selectStates.set(target, "selected");
      return true;
    }
    selectStates.delete(target);
  } else if (target.getAttribute("role") === "combobox" && target.getAttribute("aria-expanded") === "true") {
    // Autocomplete controls own their arrow and Enter selection behavior.
    return true;
  }

  const fields = eligibleFields(container);
  const fieldTarget = target.closest<HTMLElement>(fieldSelector);
  const index = fieldTarget ? fields.indexOf(fieldTarget) : -1;
  if (index < 0) return false;

  const next = fields[index + 1];
  const lastFieldAction = findLastAction(container);
  if (!next && !lastFieldAction) return false;

  event.preventDefault();
  focusNextField(container, fields, index);
  return true;
}
