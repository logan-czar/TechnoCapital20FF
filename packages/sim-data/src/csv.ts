// A small CSV tokenizer that behaves like the Rust `csv` crate's default reader on these files
// (crates/sim-data/src/load.rs uses csv::Reader::from_reader): comma delimiter, `"` quotes with
// `""` as an escaped quote, quoted fields may hold newlines, `\n`, `\r` and `\r\n` all end a record,
// empty lines are skipped, a leading UTF-8 BOM is dropped, and a quote that closes a field is
// followed by more field text as plain data (csv-core's InField state). Line numbers count `\n`
// bytes, the way load.rs's LineIndex does (csv's own counter is one short after a CRLF line).

/** The records of a CSV text, with the 1-based line each one starts on. */
export interface CsvRecords {
  records: string[][];
  lines: number[];
}

export function parseCsv(input: string): CsvRecords {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const n = text.length;
  const records: string[][] = [];
  const lines: number[] = [];
  let i = 0;
  let line = 1;
  while (i < n) {
    const c = text[i];
    // An empty line is skipped, not read as a record with one empty field.
    if (c === "\n") {
      line++;
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      if (text[i] === "\n") {
        i++;
        line++;
      }
      continue;
    }
    lines.push(line);
    const fields: string[] = [];
    for (;;) {
      let field = "";
      if (text[i] === '"') {
        i++;
        while (i < n) {
          const ch = text[i];
          if (ch === '"') {
            if (text[i + 1] === '"') {
              field += '"';
              i += 2;
              continue;
            }
            i++; // the closing quote
            break;
          }
          if (ch === "\n") line++;
          field += ch;
          i++;
        }
      }
      // The rest of the field is plain data, whether or not a quoted part came first.
      const start = i;
      while (i < n) {
        const ch = text[i];
        if (ch === "," || ch === "\n" || ch === "\r") break;
        i++;
      }
      field += text.slice(start, i);
      fields.push(field);
      if (i >= n) break;
      const ch = text[i];
      if (ch === ",") {
        i++;
        continue;
      }
      i++;
      if (ch === "\r") {
        if (text[i] === "\n") {
          i++;
          line++;
        }
      } else {
        line++;
      }
      break;
    }
    records.push(fields);
  }
  return { records, lines };
}
