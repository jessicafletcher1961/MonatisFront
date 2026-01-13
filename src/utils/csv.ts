export function parseSimpleCsv(text: string): string[][] {
  // Very simple CSV parser (no quoted commas). Good enough for internal "code;libelle" or "code,libelle".
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  return lines.map(line => {
    const sep = line.includes(";") ? ";" : ",";
    return line.split(sep).map(x => x.trim());
  });
}
