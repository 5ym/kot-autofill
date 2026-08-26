export interface BreakSpan {
  start: string; // "9:48"
  end: string; // "10:34"
}

export interface DayEntry {
  day: number; // 日 (1〜31)
  date: string; // YYYY-MM-DD
  start: string; // "9:58"
  end: string; // "21:30"
  breaks: BreakSpan[]; // 休憩時間帯 (空 = 休憩なし)
}

export interface Sheet {
  year: number;
  month: number;
  entries: DayEntry[];
}

/**
 * 稼働レポートの CSV/TSV をパースする。
 * 1行目がヘッダーで、「日付」(YYYY-MM-DD)、「稼働開始」「稼働終了」「休憩時間帯」の
 * 列を列名で見つけて使う。それ以外の列は無視する。
 * 休憩時間帯 (例 "9:48-10:34 / 10:42-14:17") はそのまま複数の休憩打刻になる。
 * 出勤・退勤とも空の行(「合計」行など)はスキップする。
 * 対象月は日付列から自動で決まる(複数月が混ざっているとエラー)。
 */
export function parseSheet(text: string): Sheet {
  const lines = text.split(/\r?\n/);
  const header = parseHeader(lines);
  const entries: DayEntry[] = [];

  for (let i = header.headerRow; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(/[\t,]/).map((c) => c.trim());

    const start = cols[header.start] ?? "";
    const end = cols[header.end] ?? "";
    // 出勤も退勤も無い行はスキップ(休日・「合計」行など)
    if (!start && !end) continue;
    if (!start || !end) {
      throw new Error(`行${i + 1}: 稼働開始/稼働終了の片方だけが空です: "${line}"`);
    }

    const dateCell = cols[header.date] ?? "";
    const m = dateCell.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) {
      throw new Error(`行${i + 1}: 日付が YYYY-MM-DD 形式ではありません: "${dateCell}"`);
    }

    entries.push({
      day: Number(m[3]),
      date: dateCell,
      start,
      end,
      breaks: parseBreaks(cols[header.breaks] ?? "", i + 1),
    });
  }

  if (entries.length === 0) throw new Error("CSVにデータ行がありません");

  const months = new Set(entries.map((e) => e.date.slice(0, 7)));
  if (months.size > 1) {
    throw new Error(`複数の月が混ざっています: ${[...months].join(", ")}`);
  }
  const [year, month] = entries[0].date.split("-").map(Number);
  return { year, month, entries };
}

/** "9:48-10:34 / 10:42-14:17" → [{start,end}, ...] (空セルは休憩なし) */
function parseBreaks(cell: string, row: number): BreakSpan[] {
  if (!cell) return [];
  return cell.split("/").map((span) => {
    const m = span.trim().match(/^(\d{1,2}:\d{2})-(\d{1,2}:\d{2})$/);
    if (!m) {
      throw new Error(`行${row}: 休憩時間帯を解釈できません: "${span.trim()}" (H:MM-H:MM 形式)`);
    }
    return { start: m[1], end: m[2] };
  });
}

interface HeaderMap {
  headerRow: number; // ヘッダーの行番号 (1始まり)
  date: number;
  start: number;
  end: number;
  breaks: number;
}

function parseHeader(lines: string[]): HeaderMap {
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cols = line.split(/[\t,]/).map((c) => c.trim());
    const find = (...names: string[]) => cols.findIndex((c) => names.includes(c));
    const date = find("日付");
    const start = find("稼働開始", "出勤");
    const end = find("稼働終了", "退勤");
    const breaks = find("休憩時間帯");
    if (date < 0 || start < 0 || end < 0 || breaks < 0) {
      throw new Error(
        "1行目に「日付」「稼働開始」「稼働終了」「休憩時間帯」のヘッダーが見つかりません。" +
          "稼働レポートをヘッダーごと data.csv に貼り付けてください",
      );
    }
    return { headerRow: i + 1, date, start, end, breaks };
  }
  throw new Error("CSVが空です");
}
