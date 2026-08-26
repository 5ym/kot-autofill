# kot-autofill

スプレッドシートの「出勤・退勤・休憩」データを KING OF TIME に自動入力(打刻申請)するツール。
Bun 1.4 の実験的ブラウザ自動化 API [`Bun.WebView`](https://bun.com/docs/runtime/webview) を使っており、Puppeteer/Playwright は不要。

**実行は Docker のみ**(Bun 1.4 + Chromium + xvfb 入りのイメージをビルドする)。
ローカルの bun で直接実行しようとするとエラーで止まる。

## 必要なもの

- Docker / Docker Compose

## セットアップ

```sh
cd kot-autofill
cp compose.override.yml.example compose.override.yml   # ログインURL・ID・パスワードを記入
docker compose build                                   # 初回とコード変更時
```

`data.csv` に稼働レポートをヘッダーごと貼り付ける(タブ区切りのコピペでも OK)。
1 行目のヘッダーから「日付」(YYYY-MM-DD)「稼働開始」「稼働終了」「休憩時間帯」の列を
列名で見つけて使い、それ以外の列は無視する。「合計」行や休憩なしの日はそのままで良い。
対象月は日付列から自動で決まる。

休憩時間帯(例 `9:48-10:34 / 10:42-14:17`)は、そのまま複数回の
休憩開始/終了の打刻として申請する。

**既に打刻が入っている日は、既存打刻に削除チェックを入れて CSV の内容で入れ直す**
(承認済みの打刻も対象になるので、`--dry-run` のスクリーンショットで必ず確認すること)。

## 使い方(この順で試すのがおすすめ)

```sh
# 1. ブラウザを開かず、入力予定の内容だけ確認
docker compose run --rm kot --plan-only

# 2. フォーム入力までやって申請ボタンは押さないリハーサル
docker compose run --rm kot --dry-run --day 1

# 3. 本番
docker compose run --rm kot
```

`bun run plan` / `dry` / `start` のショートカットも使える(中身は上の docker compose コマンド)。

`--day N` で特定の日だけ入力できる。各ステップのスクリーンショットが `shots/` に残る。

## 重要な注意

- KING OF TIME は**契約・設定によって画面構成やフォーム名が異なる**。
  `src/selectors.ts` は現在の実画面で確認済みだが、画面が変わって動かなくなったら
  `shots/` のスクリーンショットを見て修正すること。
- 申請内容は自分で最終確認すること(勤怠は正確に!)。誤入力しても KOT 上の申請は
  承認前なら取り下げられるが、`--dry-run` で事前確認するのが安全。
- パスワードは `compose.override.yml` に置くので、リポジトリにコミットしないこと(`.gitignore` 済み)。
