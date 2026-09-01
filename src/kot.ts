import { SEL } from "./selectors";
import type { DayEntry } from "./csv";
import { formatForInput } from "./time";
import {
  type WebViewLike,
  waitFor,
  setValue,
  selectByText,
  clickByText,
  clickSelector,
  disableDialogs,
  shot,
} from "./webview";

export interface KotConfig {
  loginUrl: string;
  id: string;
  password: string;
  remark: string; // 申請理由
  dryRun: boolean; // true なら申請ボタンを押さない
  schedulePattern: string; // --schedule で使うスケジュールパターン名
  scheduleDayType: string; // --schedule で使う勤務日種別
}

export async function login(view: WebViewLike, cfg: KotConfig) {
  console.log(`ログインページへ移動: ${cfg.loginUrl}`);
  await view.navigate(cfg.loginUrl);
  await waitFor(view, `document.querySelector(${JSON.stringify(SEL.login.id)})`, "ログインフォーム");
  await shot(view, "01-login-page");

  await setValue(view, SEL.login.id, cfg.id);
  await setValue(view, SEL.login.password, cfg.password);
  await view.click(SEL.login.submit);

  await waitFor(view, SEL.login.loggedIn, "ログイン完了");
  await shot(view, "02-after-login");
  console.log("ログイン成功");
}

export async function openTimecard(view: WebViewLike, year: number, month: number) {
  if (!(await view.evaluate(`!!(${SEL.timecard.ready})`))) {
    if (await view.evaluate(`!!document.querySelector(${JSON.stringify(SEL.edit.back)})`)) {
      // 編集画面に居る場合は「戻る」でタイムカードへ
      await clickSelector(view, SEL.edit.back);
    } else {
      // レコーダー画面: メニューが閉じているとリンクが不可視なので、先にメニューアイコンを開く
      try {
        await view.click(SEL.menuIcon);
        await Bun.sleep(300);
      } catch {
        /* メニューアイコンが無い画面構成なら無視 */
      }
      await clickByText(view, SEL.timecardLinkText);
    }
    await waitFor(view, SEL.timecard.ready, "タイムカード表示");
  }

  // 表示月がCSVの対象月と違えば移動する (デフォルトは今月)
  const ym = `${year}${String(month).padStart(2, "0")}`;
  const shownYm = await view.evaluate(
    `document.querySelector('input[name="working_date"]').value.slice(0, 6)`,
  );
  if (shownYm !== ym) {
    await setValue(view, SEL.timecard.monthPicker, `${year}/${String(month).padStart(2, "0")}`);
    await setValue(view, SEL.timecard.monthYearHidden, String(year));
    await setValue(view, SEL.timecard.monthMonthHidden, String(month).padStart(2, "0"));
    await clickSelector(view, SEL.timecard.monthDisplayButton);
    await waitFor(
      view,
      `(${SEL.timecard.ready}) && document.querySelector('input[name="working_date"]').value.slice(0, 6) === "${ym}"`,
      `${year}年${month}月の表示`,
    );
  }

  await shot(view, "03-timecard");
  console.log(`タイムカードを開きました (${year}年${month}月)`);
}

/**
 * タイムカード表から対象日の行を見つけて申請画面を開く。
 * 行は hidden input working_date=YYYYMMDD で特定し、行内ドロップダウンの
 * option (値が押すべきボタンのCSSセレクタ) をクリックする。
 */
async function openDayRequestPage(
  view: WebViewLike,
  entry: DayEntry,
  optionText: string,
  readyExpr: string,
  label: string,
) {
  const ymd = entry.date.replaceAll("-", "");
  const ok = await view.evaluate(`(() => {
    const dateInput = document.querySelector('input[name="working_date"][value="${ymd}"]');
    const row = dateInput && dateInput.closest("tr");
    if (!row) return "row-not-found";
    const opt = [...row.querySelectorAll("select option")]
      .find(o => o.textContent.trim() === ${JSON.stringify(optionText)});
    const btn = opt && document.querySelector(opt.value);
    if (!btn) return "link-not-found";
    btn.click();
    return "ok";
  })()`);
  if (ok !== "ok") {
    // 調査用に失敗時の画面を残す
    await shot(view, `90-fail-${entry.date}`);
    const state = await view.evaluate(
      `location.href + " | working_date数=" + document.querySelectorAll('input[name="working_date"]').length`,
    );
    throw new Error(
      `${entry.date} の行が開けません (${ok})。タイムカードの表示月と対象月が一致しているか確認してください [${state}]`,
    );
  }
  await waitFor(view, readyExpr, `${entry.date} ${label}`);
  // 個別ページへのフル遷移のたびに confirm()/alert() を無効化し直す必要がある
  await disableDialogs(view);
}

function openDayEditPage(view: WebViewLike, entry: DayEntry) {
  return openDayRequestPage(
    view,
    entry,
    SEL.timecard.requestOptionText,
    `!!document.querySelector(${JSON.stringify(SEL.edit.typeSelect.replace("{i}", "1"))})`,
    "打刻申請フォーム",
  );
}

/**
 * 休日設定の日にスケジュール申請を出して勤務日扱いにする。
 * パターンと勤務日種別は cfg.schedulePattern / cfg.scheduleDayType (時刻はパターンの既定値)。
 * 平日設定の日と申請中の日はスキップする。
 */
export async function fillSchedule(view: WebViewLike, entry: DayEntry, cfg: KotConfig) {
  const ymd = entry.date.replaceAll("-", "");
  const rowText = await view.evaluate(`(() => {
    const d = document.querySelector('input[name="working_date"][value="${ymd}"]');
    const row = d && d.closest("tr");
    return row ? row.innerText.replace(/\\s+/g, " ") : "";
  })()`);
  if (!rowText) throw new Error(`${entry.date} の行が見つかりません`);
  if (!/所定休日|法定休日|法定外休日/.test(rowText)) {
    console.log(`${entry.date}: 休日設定ではないためスキップします`);
    return;
  }
  console.log(`${entry.date}: スケジュール申請 (${cfg.schedulePattern} / ${cfg.scheduleDayType})`);

  await openDayRequestPage(
    view,
    entry,
    SEL.schedule.requestOptionText,
    SEL.schedule.ready,
    "スケジュール申請フォーム",
  );
  // ページ側のJS (パターン変更に連動して勤務日種別を再取得する等) が
  // 初期化されるのを待つ (直後に操作すると変更イベントを拾えないことがある)
  await Bun.sleep(1000);

  // 既に申請中ならスキップ (二重申請防止)
  const pendingId = await view.evaluate(
    `(document.querySelector(${JSON.stringify(SEL.schedule.requestIdInput)}) || {}).value || ""`,
  );
  if (pendingId) {
    console.log("  申請中のためスキップします");
    await clickSelector(view, SEL.schedule.back);
    await waitFor(view, SEL.timecard.ready, "タイムカードへ復帰");
    return;
  }

  await selectByText(view, SEL.schedule.patternSelect, cfg.schedulePattern);
  // パターン連動 (非同期) で勤務日種別の選択肢が更新されるのを待つ
  await waitFor(
    view,
    `[...document.querySelector(${JSON.stringify(SEL.schedule.dayTypeSelect)}).options]
      .some(o => o.textContent.includes(${JSON.stringify(cfg.scheduleDayType)}))`,
    "勤務日種別の選択肢",
  );
  await selectByText(view, SEL.schedule.dayTypeSelect, cfg.scheduleDayType);
  try {
    await setValue(view, SEL.schedule.remarkInput, cfg.remark);
  } catch {
    console.log("  (申請理由欄が見つからないためスキップ)");
  }
  await shot(view, `20-schedule-${entry.date}`);

  if (cfg.dryRun) {
    console.log("  [dry-run] 申請ボタンは押さずにタイムカードへ戻ります");
    await clickSelector(view, SEL.schedule.back);
  } else {
    await clickSelector(view, SEL.schedule.submit);
    await Bun.sleep(500);
    try {
      await clickByText(view, "OK", { exact: true });
    } catch {
      /* ダイアログ無し */
    }
  }

  await waitFor(view, SEL.timecard.ready, "タイムカードへ復帰");
  if (!cfg.dryRun) console.log("  申請しました");
}

/**
 * 1日分 (出勤・退勤・各休憩の開始/終了) を打刻申請する。
 * 既存の打刻が入っている日は削除チェックを入れて全打刻を入れ直す。
 */
export async function fillDay(view: WebViewLike, entry: DayEntry, cfg: KotConfig) {
  const records: Array<[label: string, time: string]> = [
    [SEL.edit.typeLabels.clockIn, entry.start],
  ];
  for (const b of entry.breaks) {
    records.push(
      [SEL.edit.typeLabels.breakStart, b.start],
      [SEL.edit.typeLabels.breakEnd, b.end],
    );
  }
  records.push([SEL.edit.typeLabels.clockOut, entry.end]);
  const brk = entry.breaks.map((b) => `${b.start}-${b.end}`).join(", ");
  console.log(
    `${entry.date}: 出勤 ${entry.start} / 休憩 ${brk || "なし"} / 退勤 ${entry.end}`,
  );

  // 既に申請中 ([申] マーク) の日は二重申請を避けてスキップ
  const pending = await view.evaluate(`(() => {
    const d = document.querySelector('input[name="working_date"][value="${entry.date.replaceAll("-", "")}"]');
    const row = d && d.closest("tr");
    return !!row && row.innerText.includes("[申]");
  })()`);
  if (pending) {
    console.log("  申請中のためスキップします");
    return;
  }

  await openDayEditPage(view, entry);
  await shot(view, `10-edit-${entry.date}`);

  // 既存の打刻がある日は削除チェックを入れ、CSVの内容で入れ直す
  const oldNum = await view.evaluate(
    `Number((document.querySelector('input[name="old_timerecord_num"]') || {}).value || 0)`,
  );
  if (oldNum > 0) {
    console.log(`  既存の打刻${oldNum}件に削除チェックを入れて入れ直します`);
    await view.evaluate(`[...document.querySelectorAll(${JSON.stringify(SEL.edit.removeCheckbox)})]
      .forEach(el => {
        el.checked = true;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        // 削除する既存行にも申請メッセージを入れる
        const remark = el.closest("tr") && el.closest("tr").querySelector('input[name^="request_remark_"]');
        if (remark) {
          remark.value = ${JSON.stringify(cfg.remark)};
          remark.dispatchEvent(new Event("input", { bubbles: true }));
          remark.dispatchEvent(new Event("change", { bubbles: true }));
        }
      })`);
  }

  // 新規打刻行が足りなければ「行追加」ボタンで増やす (初期4行)。
  // 行番号は連番とは限らない (既存打刻がある日は歯抜けになる) ため、
  // 実際に存在する番号を集めてその順に埋める
  const rowIds: string[] = await view.evaluate(`(() => {
    const ids = () => [...document.querySelectorAll('select[id^="recording_type_code_"]')]
      .map(el => el.id.slice("recording_type_code_".length))
      .filter(n => /^\\d+$/.test(n));
    for (let guard = 0; guard < 40 && ids().length < ${records.length}; guard++) {
      const add = document.querySelector(${JSON.stringify(SEL.edit.addRowButton)});
      if (!add) break;
      add.click();
    }
    return ids();
  })()`);
  if (rowIds.length < records.length) {
    throw new Error(`打刻行を${records.length}行に増やせませんでした (現在${rowIds.length}行)`);
  }

  for (let i = 0; i < records.length; i++) {
    const [label, time] = records[i];
    const n = rowIds[i];
    await selectByText(view, SEL.edit.typeSelect.replace("{i}", n), label);
    const hhmm = formatForInput(time, SEL.edit.timeFormat); // "09:37"
    await setValue(view, SEL.edit.timeInput.replace("{i}", n), hhmm);
    const [hh, mm] = hhmm.split(":");
    await setValue(view, SEL.edit.timeHourInput.replace("{i}", n), hh);
    await setValue(view, SEL.edit.timeMinuteInput.replace("{i}", n), mm);
    // 申請理由は行ごと (欄が無い設定の会社もあるため、見つからなくても続行)
    try {
      await setValue(view, SEL.edit.remarkInput.replaceAll("{i}", n), cfg.remark);
    } catch {
      if (i === 0) console.log("  (申請理由欄が見つからないためスキップ)");
    }
  }

  await shot(view, `11-filled-${entry.date}`);

  if (cfg.dryRun) {
    console.log("  [dry-run] 申請ボタンは押さずにタイムカードへ戻ります");
    await clickSelector(view, SEL.edit.back);
  } else {
    await clickSelector(view, SEL.edit.submit);
    // DOMベースの確認ダイアログが出る設定なら OK 相当のボタンを押す
    await Bun.sleep(500);
    try {
      await clickByText(view, "OK", { exact: true });
    } catch {
      /* ダイアログ無し */
    }
  }

  // タイムカード表へ戻るのを待つ (戻れた = 申請が受け付けられた)
  await waitFor(view, SEL.timecard.ready, "タイムカードへ復帰");
  if (!cfg.dryRun) console.log("  申請しました");
}
