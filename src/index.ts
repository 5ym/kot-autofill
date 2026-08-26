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
import { login, openTimecard, fillDay, inspect, type KotConfig } from "./kot";
import { createView } from "./webview";
import { placeBreak } from "./time";

const { values: args } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    csv: { type: "string", default: "data.csv" },
    month: { type: "string" }, // "2026-08"
    day: { type: "string" }, // 特定の日だけ入力 (例 --day 5)
    "dry-run": { type: "boolean", default: false },
    "inspect-only": { type: "boolean", default: false },
    "plan-only": { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
});

if (args.help) {
  console.log(`使い方:
  bun run src/index.ts [オプション]

オプション:
  --csv <file>      入力データ (default: data.csv)。CSV/TSV両対応
                    3列: 出勤,退勤,休憩       (行番号=日)
                    4列: 日付,出勤,退勤,休憩  (日付は 5 / 8/5 / 2026-08-05)
  --month YYYY-MM   対象月 (default: 今月)
  --day N           指定した日だけ入力
  --plan-only       ブラウザを開かず、入力予定の内容だけ表示
  --dry-run         フォーム入力まで行い、申請ボタンは押さない
  --inspect-only    ログイン→タイムカードまで進み、画面の要素をダンプ
                    (初回にセレクタを確認するために使う)

環境変数 (compose.override.yml で設定): KOT_LOGIN_URL, KOT_ID, KOT_PASSWORD, BREAK_START, REQUEST_REMARK`);
  process.exit(0);
}

// ---- 対象月 ----
const now = new Date();
let year = now.getFullYear();
let month = now.getMonth() + 1;
if (args.month) {
  const m = args.month.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) {
    console.error(`--month は YYYY-MM 形式で指定してください: ${args.month}`);
    process.exit(1);
  }
  year = Number(m[1]);
  month = Number(m[2]);
}

// ---- データ読み込み ----
const csvFile = Bun.file(args.csv!);
if (!(await csvFile.exists())) {
  console.error(`CSVファイルが見つかりません: ${args.csv}`);
  process.exit(1);
}
let entries = parseSheet(await csvFile.text(), year, month);
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
  breakStart: process.env.BREAK_START ?? "12:00",
  remark: process.env.REQUEST_REMARK ?? "勤怠自動入力",
  dryRun: args["dry-run"]!,
};

// ---- plan-only: ブラウザなしで入力内容を確認 ----
if (args["plan-only"]) {
  for (const e of entries) {
    const b = placeBreak(e.start, e.end, e.breakDur, cfg.breakStart);
    console.log(
      `${e.date}  出勤 ${e.start} → 退勤 ${e.end}  休憩 ${b.breakStart}-${b.breakEnd} (${e.breakDur})`,
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
  if (args["inspect-only"]) {
    await inspect(view, cfg, entries[0]);
  } else {
    await login(view, cfg);
    await openTimecard(view);

    const failed: string[] = [];
    for (const entry of entries) {
      try {
        await fillDay(view, entry, cfg);
      } catch (e) {
        console.error(`${entry.date} でエラー: ${e}`);
        failed.push(entry.date);
        // タイムカードへ戻ってから次の日へ
        try {
          await openTimecard(view);
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
  }
} finally {
  view.close();
}
