// Money fields hold a NUMBER in state, which makes a controlled <input> unable to correct itself:
// type "0" into a field already holding 0 and React sees no state change, never re-renders, and the
// browser keeps every extra zero — "00", "000", "0000" all stick and read as a real cost.
//
// So normalize inside the handler, where the DOM node is still in hand. Decimal text only: no
// exponent, minus, or scroll-wheel surprises. Money keeps at most two paisa digits.

import { decimalInput, decimalNumber } from "./decimal";

export function readRupees(el: HTMLInputElement): number {
  const text = decimalInput(el.value, 2);
  const amount = text === "" ? 0 : decimalNumber(text);
  el.value = text;
  return amount;
}

/** Paired with `readRupees`: a zero cost shows the placeholder, never a bare "0". */
export function rupeeValue(amount: number): string {
  return amount ? String(amount) : "";
}

// A priced stage can legitimately cost NOTHING — a complimentary review, warranty work, a step
// the clinic absorbs. A number in state cannot say that: 0 and "not priced yet" are the same
// value, so `rupeeValue` renders both as an empty box and the dentist can never assert "free".
//
// Fields that must distinguish the two keep their value as TEXT. "" is unpriced, "0" is free,
// and the number is recovered with `rupeeAmount` at submit time.

export function readRupeeText(el: HTMLInputElement): string {
  const digits = decimalInput(el.value, 2);
  // Writing back to the DOM node is what kills the trailing-zero pile-up: when the normalized
  // text equals the text already in state, React skips the re-render and the browser would
  // otherwise keep the raw "000" the user typed.
  const text = digits;
  el.value = text;
  return text;
}

export function rupeeAmount(text: string): number {
  return text === "" ? 0 : Number(text);
}
