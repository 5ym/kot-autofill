export interface DayEntry {
  /** 対象日 (1〜31 の日、または YYYY-MM-DD) */
  day: number;
  date: string; // YYYY-MM-DD
  start: string; // "9:58"
  end: string; // "21:30"
  breakDur: string; // "6:18" (休憩の長さ)
}

/**
 * CSV/TSV をパースする。対応形式:
 *   3列: 出勤,退勤,休憩          → 行番号がそのまま「日」になる (--month 必須)
 *   4列: 日付,出勤,退勤,休憩     → 日付は "5" / "8/5" / "2026-08-05" のいずれか
 * スプレッドシートからのコピペ(タブ区切り)もそのまま使える。
 */
export function parseSheet(text: string, year: number, month: number): DayEntry[] {
  const entries: DayEntry[] = [];
  const lines = text.split(/\r?\n/);
  let rowIndex = 0;

  for (const raw of lines) {
    const line = raw.trim();
    rowIndex++;
    if (!line) continue;
    const cols = line.split(/[\t,]/).map((c) => c.trim());

    let day: number;
    let times: string[];
    if (cols.length >= 4 && cols[3] !== "") {
      day = parseDayCell(cols[0], year, month);
      times = cols.slice(1, 4);
    } else if (cols.length >= 3) {
      day = rowIndex; // 3列形式: 行番号 = 日
      times = cols.slice(0, 3);
    } else {
      throw new Error(`行${rowIndex}: 列数が足りません: "${line}"`);
    }

    const [start, end, breakDur] = times;
    // 空の日はスキップ(休日など)
    if (!start && !end) continue;
    if (!start || !end || !breakDur) {
      throw new Error(`行${rowIndex}: 出勤/退勤/休憩のいずれかが空です: "${line}"`);
    }

    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    entries.push({ day, date, start, end, breakDur });
  }
  return entries;
}

function parseDayCell(cell: string, year: number, month: number): number {
  let m = cell.match(/^(\d{4})-(\d{2})-(\d{2})$/); // YYYY-MM-DD
  if (m) {
    if (Number(m[1]) !== year || Number(m[2]) !== month) {
      throw new Error(`日付 ${cell} が指定した年月 ${year}-${month} と一致しません`);
    }
    return Number(m[3]);
  }
  m = cell.match(/^(\d{1,2})\/(\d{1,2})$/); // M/D
  if (m) return Number(m[2]);
  m = cell.match(/^(\d{1,2})$/); // D
  if (m) return Number(m[1]);
  throw new Error(`日付セルを解釈できません: "${cell}"`);
}
