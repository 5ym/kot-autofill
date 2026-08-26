import { SEL } from "./selectors";
import type { DayEntry } from "./csv";
import { placeBreak, formatForInput } from "./time";
import {
  type WebViewLike,
  waitFor,
  setValue,
  selectByText,
  clickByText,
  shot,
  dumpForms,
} from "./webview";

export interface KotConfig {
  loginUrl: string;
  id: string;
  password: string;
  breakStart: string; // 休憩開始のデフォルト時刻
  remark: string; // 申請理由
  dryRun: boolean; // true なら申請ボタンを押さない
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

export async function openTimecard(view: WebViewLike) {
  await clickByText(view, SEL.timecardLinkText);
  await waitFor(view, SEL.timecard.ready, "タイムカード表示");
  await shot(view, "03-timecard");
  console.log("タイムカードを開きました");
}

/**
 * タイムカード表から対象日の行を見つけて申請リンクをクリックする。
 * 行の判定は「その行のテキストに『M/D』が含まれるか」で行う。
 */
async function openDayEditPage(view: WebViewLike, entry: DayEntry) {
  const [y, m, d] = entry.date.split("-").map(Number);
  const patterns = [
    `${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`, // 08/05
    `${m}/${d}`, // 8/5
  ];
  const ok = await view.evaluate(`(() => {
    const patterns = ${JSON.stringify(patterns)};
    const rows = [...document.querySelectorAll("tr")];
    const row = rows.find(tr => patterns.some(p => tr.textContent.includes(p)));
    if (!row) return "row-not-found";
    const link = [...row.querySelectorAll("a, button, input[type=button]")]
      .find(el => (el.textContent || el.value || "").includes(${JSON.stringify(SEL.timecard.editLinkText)}));
    if (!link) return "link-not-found";
    link.click();
    return "ok";
  })()`);
  if (ok !== "ok") {
    throw new Error(
      `${entry.date} の行が開けません (${ok})。タイムカードの表示月と対象月が一致しているか、` +
        `selectors.ts の timecard.editLinkText を確認してください`,
    );
  }
  await waitFor(
    view,
    `document.querySelector(${JSON.stringify(SEL.edit.typeSelect.replace("{i}", "1"))})`,
    `${entry.date} 打刻申請フォーム`,
  );
}

/** 1日分 (出勤・退勤・休憩開始・休憩終了) を打刻申請する */
export async function fillDay(view: WebViewLike, entry: DayEntry, cfg: KotConfig) {
  const brk = placeBreak(entry.start, entry.end, entry.breakDur, cfg.breakStart);
  const records: Array<[label: string, time: string]> = [
    [SEL.edit.typeLabels.clockIn, entry.start],
    [SEL.edit.typeLabels.breakStart, brk.breakStart],
    [SEL.edit.typeLabels.breakEnd, brk.breakEnd],
    [SEL.edit.typeLabels.clockOut, entry.end],
  ];
  console.log(
    `${entry.date}: 出勤 ${entry.start} / 休憩 ${brk.breakStart}-${brk.breakEnd} (${entry.breakDur}) / 退勤 ${entry.end}`,
  );

  await openDayEditPage(view, entry);
  await shot(view, `10-edit-${entry.date}`);

  for (let i = 0; i < records.length; i++) {
    const [label, time] = records[i];
    const n = String(i + 1);
    await selectByText(view, SEL.edit.typeSelect.replace("{i}", n), label);
    await setValue(
      view,
      SEL.edit.timeInput.replace("{i}", n),
      formatForInput(time, SEL.edit.timeFormat),
    );
  }

  // 申請理由 (欄が無い設定の会社もあるため、見つからなくても続行)
  try {
    await setValue(view, SEL.edit.remarkInput, cfg.remark);
  } catch {
    console.log("  (申請理由欄が見つからないためスキップ)");
  }

  await shot(view, `11-filled-${entry.date}`);

  if (cfg.dryRun) {
    console.log("  [dry-run] 申請ボタンは押さずにタイムカードへ戻ります");
    await view.evaluate("history.back()");
  } else {
    await clickByText(view, SEL.edit.submitText);
    // 確認ダイアログが出る設定なら OK 相当のボタンを押す
    await Bun.sleep(500);
    try {
      await clickByText(view, "OK", { exact: true });
    } catch {
      /* ダイアログ無し */
    }
    console.log("  申請しました");
  }

  // タイムカード表へ戻るのを待つ
  await waitFor(view, SEL.timecard.ready, "タイムカードへ復帰");
}

/** --inspect-only 用: ログイン→タイムカードまで進み、要素をダンプする */
export async function inspect(view: WebViewLike, cfg: KotConfig, firstEntry?: DayEntry) {
  await login(view, cfg);
  console.log("\n--- ログイン後のフォーム要素 ---\n" + (await dumpForms(view)));
  await openTimecard(view);
  console.log("\n--- タイムカードのフォーム要素 ---\n" + (await dumpForms(view)));
  if (firstEntry) {
    try {
      await openDayEditPage(view, firstEntry);
      await shot(view, "99-inspect-edit");
      console.log("\n--- 打刻申請画面のフォーム要素 ---\n" + (await dumpForms(view)));
    } catch (e) {
      console.log(`\n打刻申請画面を開けませんでした: ${e}`);
      console.log(await dumpForms(view));
    }
  }
  console.log("\nshots/ のスクリーンショットと上のダンプを見て src/selectors.ts を調整してください");
}
