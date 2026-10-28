import type { KeyboardEvent, MouseEvent } from "react";

const submitControlSelector = 'button[type="submit"], input[type="submit"]';

function dispatchSandboxedFormSubmit(form: HTMLFormElement, submitter: HTMLButtonElement | HTMLInputElement) {
  if (!form.noValidate && !submitter.formNoValidate && !form.reportValidity()) return;
  form.dispatchEvent(new SubmitEvent("submit", { bubbles: true, cancelable: true, submitter }));
}

export function handleSandboxedFormSubmitClick(event: MouseEvent<HTMLFormElement>) {
  if (event.defaultPrevented || !(event.target instanceof Element)) return;
  const submitter = event.target.closest<HTMLButtonElement | HTMLInputElement>(submitControlSelector);
  if (!submitter || submitter.disabled) return;
  event.preventDefault();
  dispatchSandboxedFormSubmit(event.currentTarget, submitter);
}

export function handleSandboxedFormSubmitKeyDown(event: KeyboardEvent<HTMLFormElement>) {
  if (event.defaultPrevented || event.key !== "Enter" || event.nativeEvent.isComposing) return;
  const target = event.target;
  if (target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement
    || (target instanceof HTMLElement && target.isContentEditable)
    || target instanceof HTMLButtonElement) return;
  if (target instanceof HTMLInputElement
    && ["button", "submit", "reset", "checkbox", "radio", "file", "hidden", "image"].includes(target.type)) return;

  const submitter = event.currentTarget.querySelector<HTMLButtonElement | HTMLInputElement>(
    `${submitControlSelector}:not(:disabled)`,
  );
  if (!submitter) return;
  event.preventDefault();
  dispatchSandboxedFormSubmit(event.currentTarget, submitter);
}
