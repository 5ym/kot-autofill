/**
 * Bun.WebView (Bun 1.4+ の実験的ブラウザ自動化API) の薄いラッパー。
 * https://bun.com/docs/runtime/webview
 */

export interface WebViewLike {
  navigate(url: string): Promise<void>;
  evaluate(js: string): Promise<any>;
  click(selector: string): Promise<void>;
  type(text: string): Promise<void>;
  press(key: string): Promise<void>;
  screenshot(opts?: Record<string, unknown>): Promise<Uint8Array>;
  close(): void;
  readonly url: string;
}

export function createView(): WebViewLike {
  const B = Bun as any;
  if (!B.WebView) {
    throw new Error(
      "Bun.WebView が見つかりません。Bun 1.4 以上が必要です (`bun upgrade` を実行)。" +
        `現在のバージョン: ${Bun.version}`,
    );
  }
  // Linux/Windows では Chrome/Chromium/Edge のインストールが必要
  return new B.WebView({ width: 1280, height: 900, backend: "chrome" });
}

/** JS式が truthy になるまでポーリングして待つ (waitForSelector 相当) */
export async function waitFor(
  view: WebViewLike,
  expr: string,
  label: string,
  timeoutMs = 20_000,
): Promise<void> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    try {
      if (await view.evaluate(`!!(${expr})`)) return;
    } catch {
      // ナビゲーション中は evaluate が失敗しうるので無視してリトライ
    }
    await Bun.sleep(250);
  }
  throw new Error(`待機タイムアウト (${label}): ${expr}`);
}

/** セレクタに値を直接設定し input/change イベントを発火する */
export async function setValue(view: WebViewLike, selector: string, value: string) {
  const ok = await view.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.value = ${JSON.stringify(value)};
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`要素が見つかりません: ${selector}`);
}

/** select 要素を「表示テキスト」で選択する */
export async function selectByText(view: WebViewLike, selector: string, text: string) {
  const ok = await view.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    const opt = [...el.options].find(o => o.textContent.trim().includes(${JSON.stringify(text)}));
    if (!opt) return false;
    el.value = opt.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  })()`);
  if (!ok) throw new Error(`select が見つからないか option "${text}" がありません: ${selector}`);
}

/** 表示テキストでリンク/ボタンを探してクリックする */
export async function clickByText(
  view: WebViewLike,
  text: string,
  opts: { within?: string; exact?: boolean } = {},
) {
  const ok = await view.evaluate(`(() => {
    const root = ${opts.within ? `document.querySelector(${JSON.stringify(opts.within)})` : "document"};
    if (!root) return false;
    const els = [...root.querySelectorAll("a, button, input[type=button], input[type=submit], div, span")];
    const target = els.find(el => {
      const t = (el.textContent || el.value || "").trim();
      return ${opts.exact ? `t === ${JSON.stringify(text)}` : `t.includes(${JSON.stringify(text)})`}
        && el.offsetParent !== null;
    });
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!ok) throw new Error(`テキスト "${text}" の要素が見つかりません`);
}

/** デバッグ用: 現在ページのフォーム要素を一覧するダンプを返す */
export async function dumpForms(view: WebViewLike): Promise<string> {
  return await view.evaluate(`(() => {
    const rows = [...document.querySelectorAll("input, select, textarea, button")].map(el => {
      const opts = el.tagName === "SELECT"
        ? " options=[" + [...el.options].map(o => o.value + ":" + o.textContent.trim()).join(", ") + "]"
        : "";
      return el.tagName.toLowerCase()
        + " id=" + (el.id || "-")
        + " name=" + (el.name || "-")
        + " type=" + (el.type || "-")
        + " value=" + JSON.stringify((el.value || "").slice(0, 20))
        + opts;
    });
    return "URL: " + location.href + "\\n" + rows.join("\\n");
  })()`);
}

export async function shot(view: WebViewLike, name: string) {
  const png = await view.screenshot();
  await Bun.write(`shots/${name}.png`, png);
}
