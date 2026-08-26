/**
 * KING OF TIME の画面セレクタ設定 (実画面で確認済みの値)。
 * KOTは契約・設定によって画面構成が変わりうるため、動かなくなったら
 * shots/ のスクリーンショットを見てここを実画面に合わせて修正すること。
 */
export const SEL = {
  login: {
    id: "#id",
    password: "#password",
    // ログインボタン (「OK」の div)
    submit: "div.btn-control-message",
    // ログイン成功判定: ログインフォームが消えること
    loggedIn: `!document.querySelector("#password") && !document.body.innerText.includes("パスワード")`,
  },

  // ハンバーガーメニューを開いてから「タイムカード」リンクをクリックする
  menuIcon: "#menu_icon",
  timecardLinkText: "タイムカード",

  timecard: {
    // タイムカード表が表示されたことの判定。
    // 各日の行 (working_date) があり、かつ編集画面 (打刻追加ボタンがある) ではないこと
    ready: `!!document.querySelector('input[name="working_date"]') && !document.querySelector("#recording_timestamp_add")`,
    // 各日の行は hidden input working_date=YYYYMMDD で特定する。
    // 申請は行内ドロップダウンの「打刻申請」option (値が押すべきボタンのCSSセレクタ)
    requestOptionText: "打刻申請",
  },

  edit: {
    // 打刻申請画面のフォーム要素。{i} は 1 始まりの行番号に置換される
    typeSelect: `select[name="recording_type_code_{i}"]`,
    timeInput: `input[name="recording_timestamp_time_{i}"]`,
    // 送信に実際に使われる hidden の時/分 (画面のJSがtimeInputから転記するが、
    // 合成イベントでは転記されないため直接設定する)
    timeHourInput: `input[name="recording_timestamp_hour_{i}"]`,
    timeMinuteInput: `input[name="recording_timestamp_minute_{i}"]`,
    // 種別 select の option 値ではなく「表示テキスト」で選ぶ
    typeLabels: {
      clockIn: "出勤",
      clockOut: "退勤",
      breakStart: "休憩開始",
      breakEnd: "休憩終了",
    },
    // 時刻入力欄の形式 (既存行の表示に合わせる)
    timeFormat: "HH:MM" as "HHmm" | "HH:MM",
    // 打刻行の「行追加」ボタン (初期は4行しかない)
    addRowButton: "#recording_timestamp_add",
    // 既存打刻行の「削除」チェックボックス
    removeCheckbox: `input[name^="remove_timerecord_"]`,
    // 申請理由欄 (行ごと)
    remarkInput: `input[name="request_remark_{i}"], textarea[name="request_remark_{i}"]`,
    // 申請ボタン
    submit: "#button_01",
    // タイムカードへ戻るボタン (POST遷移のため history.back() では戻れない)
    back: "#button_03",
  },
};
