/**
 * A page's data as a file. A cell that starts as a formula is quoted so a spreadsheet never runs it, and the link
 * that carries the file is cleaned up after the browser has taken it.
 */

/** One cell, escaped: quotes doubled, a formula's lead character defused. */
export function csvCell(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value);
  const guarded = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/** Downloads `rows` under `name` (the head first). Returns nothing: the browser takes it from here. */
export function downloadCsv(
  name: string,
  head: readonly string[],
  rows: readonly (readonly unknown[])[],
): void {
  const lines = [head.join(','), ...rows.map((row) => row.map(csvCell).join(','))];
  const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
