export const BARLINES = new Set([',', ';', ':', '::']);

export function tokenizeMelody(str) {
  return str.trim().split(/\s+/).filter(Boolean);
}
