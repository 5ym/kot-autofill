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

