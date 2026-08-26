# kot-autofill

スプレッドシートの「出勤・退勤・休憩」データを KING OF TIME に自動入力(打刻申請)するツール。
Bun 1.4 の実験的ブラウザ自動化 API [`Bun.WebView`](https://bun.com/docs/runtime/webview) を使っており、Puppeteer/Playwright は不要。

## 必要なもの

- **Bun 1.4 以上** — `bun upgrade` で更新(`Bun.WebView` は 1.4 の新機能)
- **Chrome / Chromium / Edge** — Linux(WSL2含む)では WebView のバックエンドとして必要
  ```sh
  sudo apt install chromium-browser
  # または Google Chrome の .deb をインストール
  ```

## セットアップ

```sh
cd kot-autofill
cp .env.example .env   # ログインURL・ID・パスワードを記入
```

`data.csv` にスプレッドシートの A〜C 列(出勤, 退勤, 休憩)を貼り付ける。
タブ区切り(シートからそのままコピペ)でも OK。行番号がそのまま「日」になる。
日付を明示したい場合は 4 列形式 `日付,出勤,退勤,休憩` で書く(日付は `5` / `8/5` / `2026-08-05`)。

休憩は「長さ」(例 `6:18`)で指定する。`BREAK_START`(既定 12:00)から開始した
休憩開始/終了の打刻に変換し、退勤に収まらない場合は自動で前倒しする。

## 使い方(この順で試すのがおすすめ)

```sh
# 1. ブラウザを開かず、入力予定の内容だけ確認
bun run src/index.ts --plan-only --month 2026-08

# 2. 初回のみ: ログイン→タイムカードまで進めて画面要素をダンプ
#    shots/*.png と出力を見て src/selectors.ts の [要確認] 箇所を実画面に合わせる
bun run src/index.ts --inspect-only

# 3. フォーム入力までやって申請ボタンは押さないリハーサル
bun run src/index.ts --dry-run --day 1

# 4. 本番
bun run src/index.ts --month 2026-08
```

`--day N` で特定の日だけ入力できる。各ステップのスクリーンショットが `shots/` に残る。

## 重要な注意

- KING OF TIME は**契約・設定によって画面構成やフォーム名が異なる**。
  `src/selectors.ts` の既定値は一般的な従業員画面(打刻申請)を想定した推測値なので、
  **必ず `--inspect-only` → `--dry-run` で確認してから本番実行**すること。
- 申請内容は自分で最終確認すること(勤怠は正確に!)。誤入力しても KOT 上の申請は
  承認前なら取り下げられるが、`--dry-run` で事前確認するのが安全。
- `.env` にパスワードを置くので、リポジトリにコミットしないこと(`.gitignore` 済み)。
