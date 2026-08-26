/**
 * KING OF TIME の画面セレクタ設定。
 *
 * KOTは契約・設定によって画面構成が変わるため、初回は
 *   bun run src/index.ts --inspect-only
 * で各ステップのスクリーンショット(shots/)とフォーム要素ダンプを確認し、
 * 実際の画面に合わせてここを修正すること。[要確認] を付けた箇所は特に注意。
 */
export const SEL = {
  login: {
    id: "#login_id",
    password: "#login_password",
    // ログインボタン [要確認] (画面によっては .btn-control-message)
    submit: "div.btn-control-message",
    // ログイン成功判定: 従業員メニューが出ること [要確認]
    loggedIn: `document.body.innerText.includes("タイムカード")`,
  },

  // メニューの「タイムカード」リンクをテキストで探してクリックする
  timecardLinkText: "タイムカード",

  timecard: {
    // タイムカード表が表示されたことの判定 [要確認]
    ready: `!!document.querySelector("table") && document.body.innerText.includes("打刻")`,
    // 各日の行から申請画面へ飛ぶリンクのテキスト [要確認]
    // (「申請」「打刻申請」など。行内のリンク文字列)
    editLinkText: "申請",
  },

  edit: {
    // 打刻申請画面のフォーム要素。{i} は 1 始まりの行番号に置換される [要確認]
    typeSelect: `select[name="recording_type_code_{i}"]`,
    timeInput: `input[name="recording_timestamp_time_{i}"]`,
    // 種別 select の option 値ではなく「表示テキスト」で選ぶ
    typeLabels: {
      clockIn: "出勤",
      clockOut: "退勤",
      breakStart: "休憩開始",
      breakEnd: "休憩終了",
    },
    // 時刻入力欄の形式: "HHmm" (0958) か "HH:MM" (09:58) [要確認]
    timeFormat: "HHmm" as "HHmm" | "HH:MM",
    // 申請理由欄 [要確認] (行ごとの場合は {i} 付きに変更)
    remarkInput: `textarea[name="request_remark_1"], input[name="request_remark_1"]`,
    // 申請ボタンのテキスト [要確認]
    submitText: "打刻申請",
  },
};
