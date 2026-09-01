import { parseArgs } from "util";
import { existsSync } from "fs";

// 必ず Docker コンテナ内で実行する (ローカルの bun 直実行を禁止)
if (!existsSync("/.dockerenv") && !process.env.ALLOW_LOCAL) {
  console.error(
    "このツールは Docker で実行してください:\n" +
      "  docker compose run --rm kot --plan-only\n" +
      "(どうしてもローカルで動かす場合は ALLOW_LOCAL=1 を設定)",
  );
  process.exit(1);
}
import { parseSheet } from "./csv";
import { login, openTimecard, fillDay, fillSchedule, type KotConfig } from "./kot";
import { createView } from "./webview";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    csv: { type: "string", default: "data.csv" },
    day: { type: "string" }, // 特定の日だけ入力 (例 --day 5)
    "dry-run": { type: "boolean", default: false },
    "plan-only": { type: "boolean", default: false },
    schedule: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (args.help) {
  console.log(`使い方:
  bun run src/index.ts [オプション]

稼働レポートのCSV (ヘッダー付き: 日付,稼働開始,稼働終了,休憩合計,...) を
data.csv に貼り付けて実行する。対象月は日付列から自動で決まる。

オプション:
  --csv <file>      入力データ (default: data.csv)。CSV/TSV両対応
  --day N           指定した日だけ入力
  --plan-only       ブラウザを開かず、入力予定の内容だけ表示
  --dry-run         フォーム入力まで行い、申請ボタンは押さない
  --schedule        打刻申請の代わりにスケジュール申請を行う
                    (休日設定の日を勤務日扱いにする。平日設定の日はスキップ)

環境変数 (compose.override.yml で設定): KOT_LOGIN_URL, KOT_ID, KOT_PASSWORD, REQUEST_REMARK,
  SCHEDULE_PATTERN (既定: 通常勤務), SCHEDULE_DAY_TYPE (既定: 平日)`);
  process.exit(0);
}

// ---- データ読み込み ----
const csvFile = Bun.file(args.csv!);
if (!(await csvFile.exists())) {
  console.error(`CSVファイルが見つかりません: ${args.csv}`);
  process.exit(1);
}
const { year, month, entries: allEntries } = parseSheet(await csvFile.text());
let entries = allEntries;
if (args.day) {
  const d = Number(args.day);
  entries = entries.filter((e) => e.day === d);
  if (entries.length === 0) {
    console.error(`--day ${d} に該当する行がCSVにありません`);
    process.exit(1);
  }
}
console.log(`対象: ${year}年${month}月 / ${entries.length}日分\n`);

const cfg: KotConfig = {
  loginUrl: process.env.KOT_LOGIN_URL ?? "https://s3.kingtime.jp/independent/",
  id: process.env.KOT_ID ?? "",
  password: process.env.KOT_PASSWORD ?? "",
  remark: process.env.REQUEST_REMARK ?? "勤怠自動入力",
  dryRun: args["dry-run"]!,
  schedulePattern: process.env.SCHEDULE_PATTERN ?? "通常勤務",
  scheduleDayType: process.env.SCHEDULE_DAY_TYPE ?? "平日",
};

// ---- plan-only: ブラウザなしで入力内容を確認 ----
if (args["plan-only"]) {
  for (const e of entries) {
    const brk = e.breaks.map((b) => `${b.start}-${b.end}`).join(", ");
    console.log(
      `${e.date}  出勤 ${e.start} → 退勤 ${e.end}  休憩 ${brk || "なし"}`,
    );
  }
  process.exit(0);
}

if (!cfg.id || !cfg.password) {
  console.error(
    "compose.override.yml に KOT_ID / KOT_PASSWORD を設定してください " +
      "(compose.override.yml.example を参照)",
  );
  process.exit(1);
}

// ---- ブラウザ起動 ----
const view = createView();
try {
  await login(view, cfg);
  await openTimecard(view, year, month);

  const failed: string[] = [];
  for (const entry of entries) {
    try {
      if (args.schedule) {
        await fillSchedule(view, entry, cfg);
      } else {
        await fillDay(view, entry, cfg);
      }
    } catch (e) {
      console.error(`${entry.date} でエラー: ${e}`);
      failed.push(entry.date);
      // タイムカードへ戻ってから次の日へ
      try {
        await openTimecard(view, year, month);
      } catch {
        throw new Error("タイムカードへ復帰できないため中断します");
      }
    }
  }

  console.log(
    `\n完了: ${entries.length - failed.length}/${entries.length} 日分` +
      (cfg.dryRun ? " (dry-run: 申請は未送信)" : ""),
  );
  if (failed.length) console.log(`失敗した日: ${failed.join(", ")}`);
} finally {
  view.close();
}
