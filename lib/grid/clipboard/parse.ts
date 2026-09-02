// 클립보드 → raw 문자열 2D — 설계서 §4.5.1
// HTML <table>이 있으면 셀 경계는 HTML에서(줄바꿈 셀 안전), 없으면 Excel식 TSV 파서.

export interface ClipboardData {
  html?: string;
  text?: string;
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, code: string) => {
    if (code.startsWith("#")) {
      const num =
        code[1]?.toLowerCase() === "x"
          ? parseInt(code.slice(2), 16)
          : parseInt(code.slice(1), 10);
      return Number.isNaN(num) ? match : String.fromCodePoint(num);
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

function cellText(inner: string): string {
  return decodeEntities(
    inner.replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
  );
}

/** Excel풍 HTML table 파싱. colspan/rowspan은 빈 셀로 전개.
 *  ponytail: 정규식 태그 스캔 — 중첩 <table>은 미지원(Excel 클립보드는 중첩 없음). 필요해지면 토크나이저로. */
function parseHtmlTable(html: string): string[][] | null {
  const table = /<table[^>]*>([\s\S]*?)<\/table>/i.exec(html);
  if (!table) return null;
  const rows: string[][] = [];
  // (row, col) 점유 표시 — rowspan 전개용
  const occupied = new Map<string, true>();
  const trRe = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  let r = 0;
  while ((trMatch = trRe.exec(table[1])) !== null) {
    const row: string[] = [];
    const tdRe = /<t([dh])\b([^>]*)>([\s\S]*?)<\/t\1>/gi;
    let tdMatch: RegExpExecArray | null;
    let c = 0;
    while ((tdMatch = tdRe.exec(trMatch[1])) !== null) {
      while (occupied.has(`${r}:${c}`)) {
        row[c] = "";
        c++;
      }
      const attrs = tdMatch[2];
      const colspan = Number(/colspan\s*=\s*"?(\d+)"?/i.exec(attrs)?.[1] ?? 1) || 1;
      const rowspan = Number(/rowspan\s*=\s*"?(\d+)"?/i.exec(attrs)?.[1] ?? 1) || 1;
      row[c] = cellText(tdMatch[3]);
      for (let dc = 0; dc < colspan; dc++) {
        if (dc > 0) row[c + dc] = "";
        for (let dr = 1; dr < rowspan; dr++) occupied.set(`${r + dr}:${c + dc}`, true);
      }
      c += colspan;
    }
    rows.push(row);
    r++;
  }
  return rows.length > 0 ? rows : null;
}

/** Excel식 TSV: 셀 시작의 `"`가 인용 개시, `""`는 이스케이프, 인용 안 \t·\n 허용 */
function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let cellStarted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else inQuotes = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"' && !cellStarted) {
      inQuotes = true;
      cellStarted = true;
      continue;
    }
    if (ch === "\t") {
      row.push(cell);
      cell = "";
      cellStarted = false;
      continue;
    }
    if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      cellStarted = false;
      continue;
    }
    cell += ch;
    cellStarted = true;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

/** 직사각형 패딩 + 후행 빈 행/열 제거 */
function normalize(rows: string[][]): string[][] {
  if (rows.length === 0) return [];
  let width = Math.max(...rows.map((r) => r.length));
  const grid = rows.map((r) => {
    const out = new Array<string>(width);
    for (let c = 0; c < width; c++) out[c] = r[c] ?? "";
    return out;
  });
  while (grid.length > 0 && grid[grid.length - 1].every((c) => c.trim() === "")) {
    grid.pop();
  }
  while (width > 0 && grid.every((r) => r[width - 1].trim() === "")) width--;
  if (width === 0 || grid.length === 0) return [];
  return grid.map((r) => r.slice(0, width));
}

export function parseClipboard({ html, text }: ClipboardData): string[][] {
  if (html && /<table/i.test(html)) {
    const rows = parseHtmlTable(html);
    if (rows) return normalize(rows);
  }
  if (text) return normalize(parseTsv(text));
  return [];
}
