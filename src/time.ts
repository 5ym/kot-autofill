import type { DayEntry } from "./csv";

/** "9:58" / "09:58" → 分数 */
export function toMinutes(hhmm: string): number {
  const m = hhmm.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) throw new Error(`時刻の形式が不正です: "${hhmm}" (H:MM 形式で指定)`);
  return Number(m[1]) * 60 + Number(m[2]);
}

/** 分数 → "09:58" */
export function toHHMM(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** KOTの時刻入力欄向けフォーマット ("HHmm" なら "0958") */
export function formatForInput(hhmm: string, style: "HHmm" | "HH:MM"): string {
  const min = toMinutes(hhmm);
  const s = toHHMM(min);
  return style === "HHmm" ? s.replace(":", "") : s;
}

/** 実働 (分) = 退勤 − 出勤 − 休憩の合計 */
export function workMinutes(entry: DayEntry): number {
  const breaks = entry.breaks.reduce((a, b) => a + (toMinutes(b.end) - toMinutes(b.start)), 0);
  return toMinutes(entry.end) - toMinutes(entry.start) - breaks;
}

/**
 * 実働が minWorkMinutes に満たない日は、推定した休憩を外して出勤〜退勤だけにする。
 *
 * 稼働レポートの休憩は「活動ログの空白」からの推定で、会議やコーディングで
 * ログに残る出力が少なかった日は、働いていた時間が休憩として切られる。
 * そういう日は活動ログの最初と最後 (出勤・退勤) だけを使う。
 * **時刻を作りはしない。** 出勤・退勤はログそのままで、推定の休憩を信じないだけ。
 * minWorkMinutes が 0 なら何もしない。
 */
export function applyMinWork(
  entry: DayEntry,
  minWorkMinutes: number,
): { entry: DayEntry; adjusted: boolean } {
  if (minWorkMinutes <= 0 || entry.breaks.length === 0) return { entry, adjusted: false };
  if (workMinutes(entry) >= minWorkMinutes) return { entry, adjusted: false };
  return { entry: { ...entry, breaks: [] }, adjusted: true };
}

