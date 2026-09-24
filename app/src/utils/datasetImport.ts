/** Parse benchmark files without losing quoted CSV fields or native evidence. */
export function parseDatasetFile(text: string, format: 'csv' | 'json' | 'jsonl'): { records: Record<string, any>[]; corpusVersion: string | null } {
  let value: any;
  text = text.replace(/^\uFEFF/, '');
  if (format === 'json') value = JSON.parse(text);
  else if (format === 'jsonl') value = text.split(/\r?\n/).filter(line => line.trim()).map(line => JSON.parse(line));
  else {
    const rows: string[][] = []; let row: string[] = [], cell = '', quoted = false;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char === '"') {
        if (quoted && text[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
      } else if (!quoted && (char === ',' || char === '\n' || char === '\r')) {
        row.push(cell); cell = '';
        if (char !== ',') { if (row.some(entry => entry.trim())) rows.push(row); row = []; if (char === '\r' && text[i + 1] === '\n') i++; }
      } else cell += char;
    }
    if (quoted) throw new Error('CSV contains an unclosed quoted field.');
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const headers = rows.shift()?.map(header => header.trim()) || [];
    if (new Set(headers).size !== headers.length) throw new Error('CSV headers must be unique.');
    value = rows.map(fields => {
      if (fields.length !== headers.length) throw new Error('CSV row has a different number of columns from the header.');
      return Object.fromEntries(headers.map((key, index) => {
        const entry = fields[index];
        if (entry.trim().startsWith('[') || entry.trim().startsWith('{')) {
          try { return [key, JSON.parse(entry)]; } catch { /* Preserve text for validation. */ }
        }
        return [key, entry];
      }));
    });
  }
  const records = Array.isArray(value) ? value : value?.cases;
  if (!Array.isArray(records) || !records.length || records.some(row => !row || typeof row !== 'object' || Array.isArray(row))) throw new Error('The file must contain evaluation-case objects.');
  if (records.length > 10000) throw new Error('The file exceeds the 10,000 case limit.');
  return { records, corpusVersion: Array.isArray(value) ? null : value.corpus_version || null };
}
