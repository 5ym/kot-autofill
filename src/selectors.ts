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
    // 月選択ピッカーはタイムカード一覧ページにしか無い (打刻申請/スケジュール申請の
    // 個別編集ページにも working_date は1個だけ存在するため、それだけでは判定できない)
    ready: `!!document.querySelector("#select_year_month_picker")`,
    // 表示月の切り替え (デフォルトは今月なので、対象月へ移動する)
    monthPicker: "#select_year_month_picker",
    monthYearHidden: "#year",
    monthMonthHidden: "#month",
    monthDisplayButton: "#display_button",
    // 各日の行は hidden input working_date=YYYYMMDD で特定する。
    // 申請は行内ドロップダウンの「打刻申請」option (値が押すべきボタンのCSSセレクタ)
    requestOptionText: "打刻申請",
  },

  schedule: {
    // タイムカード行のドロップダウンの option テキスト
    requestOptionText: "スケジュール申請",
    // スケジュール申請フォーム
    ready: `!!document.querySelector('select[name="schedule_pattern_id"]')`,
    patternSelect: `select[name="schedule_pattern_id"]`,
    dayTypeSelect: `select[name="work_day_type_code"]`,
    // 申請中の場合はここに既存申請のIDが入る
    requestIdInput: `input[name="schedule_request_id"]`,
    remarkInput: `input[name="remark"], textarea[name="remark"]`,
    submit: "#button_01",
    back: "#button_03",
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
