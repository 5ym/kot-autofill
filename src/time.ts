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

export interface BreakWindow {
  breakStart: string;
  breakEnd: string;
}

/**
 * 休憩の「長さ」を 休憩開始/終了 の時刻に変換する。
 * 原則 defaultStart (例 12:00) から開始し、退勤時刻に収まらない場合は
 * 収まるように開始を前倒しする。
 */
export function placeBreak(
  start: string,
  end: string,
  breakDur: string,
  defaultStart: string,
): BreakWindow {
  const s = toMinutes(start);
  const e = toMinutes(end);
  const dur = toMinutes(breakDur);
  if (dur <= 0) throw new Error("休憩時間が0以下です");
  if (e - s < dur) {
    throw new Error(
      `休憩(${breakDur})が勤務時間(${start}-${end})より長いため配置できません`,
    );
  }
  let bs = Math.max(toMinutes(defaultStart), s);
  if (bs + dur > e) bs = e - dur; // 退勤までに収まるよう前倒し
  return { breakStart: toHHMM(bs), breakEnd: toHHMM(bs + dur) };
}
