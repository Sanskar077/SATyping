/**
 * Physical keyboard row layout for the Virtual Keyboard — pure layout/geometry data (which
 * physical key sits where, how wide it is, its shifted counterpart). Character data still comes
 * exclusively from ism-remington-map.ts / keyboard-metadata.ts; this file never assigns a
 * Devanagari character to a key.
 */

export interface PhysicalKey {
  /** event.key value for the UNSHIFTED press — also the REMINGTON_MAP lookup key. */
  key: string;
  /** event.key value for the SHIFTED press, if this key has one. */
  shiftKey?: string;
  /** Label shown for purely functional keys with no Devanagari output (Esc, Tab, etc). */
  label?: string;
  /** Relative width, in "key units" (1 = standard key width). */
  width?: number;
  functional?: boolean;
}

const row = (keys: PhysicalKey[]): PhysicalKey[] => keys;

export const FUNCTION_ROW: PhysicalKey[] = row([
  { key: "Escape", label: "Esc", functional: true, width: 1 },
  ...Array.from({ length: 12 }, (_, i) => ({ key: `F${i + 1}`, label: `F${i + 1}`, functional: true, width: 1 })),
]);

export const NUMBER_ROW: PhysicalKey[] = row([
  { key: "`", shiftKey: "~" },
  { key: "1", shiftKey: "!" },
  { key: "2", shiftKey: "@" },
  { key: "3", shiftKey: "#" },
  { key: "4", shiftKey: "$" },
  { key: "5", shiftKey: "%" },
  { key: "6", shiftKey: "^" },
  { key: "7", shiftKey: "&" },
  { key: "8", shiftKey: "*" },
  { key: "9", shiftKey: "(" },
  { key: "0", shiftKey: ")" },
  { key: "-", shiftKey: "_" },
  { key: "=", shiftKey: "+" },
  { key: "Backspace", label: "Backspace", functional: true, width: 2 },
]);

export const TAB_ROW: PhysicalKey[] = row([
  { key: "Tab", label: "Tab", functional: true, width: 1.5 },
  { key: "q", shiftKey: "Q" },
  { key: "w", shiftKey: "W" },
  { key: "e", shiftKey: "E" },
  { key: "r", shiftKey: "R" },
  { key: "t", shiftKey: "T" },
  { key: "y", shiftKey: "Y" },
  { key: "u", shiftKey: "U" },
  { key: "i", shiftKey: "I" },
  { key: "o", shiftKey: "O" },
  { key: "p", shiftKey: "P" },
  { key: "[", shiftKey: "{" },
  { key: "]", shiftKey: "}" },
  { key: "\\", shiftKey: "|", width: 1.5 },
]);

export const HOME_ROW: PhysicalKey[] = row([
  { key: "CapsLock", label: "Caps Lock", functional: true, width: 1.75 },
  { key: "a", shiftKey: "A" },
  { key: "s", shiftKey: "S" },
  { key: "d", shiftKey: "D" },
  { key: "f", shiftKey: "F" },
  { key: "g", shiftKey: "G" },
  { key: "h", shiftKey: "H" },
  { key: "j", shiftKey: "J" },
  { key: "k", shiftKey: "K" },
  { key: "l", shiftKey: "L" },
  { key: ";", shiftKey: ":" },
  { key: "'", shiftKey: "\"" },
  { key: "Enter", label: "Enter", functional: true, width: 2.25 },
]);

export const SHIFT_ROW: PhysicalKey[] = row([
  { key: "Shift", label: "Shift", functional: true, width: 2.25 },
  { key: "z", shiftKey: "Z" },
  { key: "x", shiftKey: "X" },
  { key: "c", shiftKey: "C" },
  { key: "v", shiftKey: "V" },
  { key: "b", shiftKey: "B" },
  { key: "n", shiftKey: "N" },
  { key: "m", shiftKey: "M" },
  { key: ",", shiftKey: "<" },
  { key: ".", shiftKey: ">" },
  { key: "/", shiftKey: "?" },
  { key: "Shift", label: "Shift", functional: true, width: 2.75 },
]);

export const BOTTOM_ROW: PhysicalKey[] = row([
  { key: "Control", label: "Ctrl", functional: true, width: 1.25 },
  { key: "Meta", label: "Win", functional: true, width: 1.25 },
  { key: "Alt", label: "Alt", functional: true, width: 1.25 },
  { key: " ", label: "Space", functional: false, width: 6.25 },
  { key: "Alt", label: "Alt", functional: true, width: 1.25 },
  { key: "Meta", label: "Win", functional: true, width: 1.25 },
  { key: "Control", label: "Ctrl", functional: true, width: 1.25 },
]);

export const KEYBOARD_ROWS: PhysicalKey[][] = [
  FUNCTION_ROW, NUMBER_ROW, TAB_ROW, HOME_ROW, SHIFT_ROW, BOTTOM_ROW,
];
