// 부록 F.2·F.3 — 코드 블록의 섹션 주석 추출(목차 서브 항목·제목 폴백). 순수 함수.
//
// 한 줄에서 우선순위대로 판정: `# ── 제목 ──` → `# ▸ 제목` → `# %% 제목` →
// 단락 첫 줄(코드 첫 줄 포함)의 평범한 `# 제목`. 들여쓴 주석은 섹션이 아니다.
// 노이즈(`#!…` shebang, `# -*- …` 코딩 선언)는 건너뛰고, 연속 중복 제목은 하나로,
// 제목은 60자에서 자른다(… 접미).

export interface CodeSection {
  title: string;
  /** 0-기반 줄 번호 (편집기 스크롤용) */
  line: number;
}

const MAX_TITLE = 60;

/** 제목 앞뒤 장식 문자 제거 + 60자 컷 (소스 PyRunner cellTocEntry와 같은 계열) */
function clean(s: string): string {
  const t = s.replace(/^[►▸▹•·>=\-─━═%\s]+/, "").replace(/[─━═\s]+$/, "").trim();
  return t.length > MAX_TITLE ? `${t.slice(0, MAX_TITLE)}…` : t;
}

/** 한 줄에서 섹션 제목 추출 — 섹션이 아니면 null */
function sectionTitle(line: string, paragraphStart: boolean): string | null {
  if (!line.startsWith("#")) return null; // 들여쓴 주석·코드 줄
  if (line.startsWith("#!") || /^#\s*-\*-/.test(line)) return null; // shebang·코딩 선언
  const body = line.replace(/^#\s*/, "").trim();
  if (body === "") return null;
  const box = /^[─━═-]{2,}\s*(.+?)\s*[─━═-]{2,}$/.exec(body); // # ── 제목 ──
  if (box) return clean(box[1]) || null;
  if (/^[▸►▹]/.test(body)) return clean(body.slice(1)) || null; // # ▸ 제목
  if (body.startsWith("%%")) return clean(body.slice(2)) || null; // # %% 제목
  return paragraphStart ? clean(body) || null : null; // 단락 첫 줄의 # 제목
}

/** 코드 → 섹션 목록 (목차 서브 항목). 연속 중복 제목은 첫 번째만 남긴다 */
export function codeSections(code: string): CodeSection[] {
  const lines = code.split(/\r?\n/);
  const out: CodeSection[] = [];
  let paragraphStart = true; // 첫 줄은 단락 시작
  for (let i = 0; i < lines.length; i++) {
    const title = sectionTitle(lines[i], paragraphStart);
    if (title && out[out.length - 1]?.title !== title) out.push({ title, line: i });
    paragraphStart = lines[i].trim() === "";
  }
  return out;
}

/**
 * 제목 폴백(부록 F.3) — 첫 섹션 제목, 없으면 첫 `# …` 줄에서 유도.
 * 표시 전용: 스토어에 저장하지 않는다.
 */
export function codeTitle(code: string): string {
  const first = codeSections(code)[0];
  if (first) return first.title;
  for (const line of code.split(/\r?\n/)) {
    const t = sectionTitle(line, true);
    if (t) return t;
  }
  return "";
}
