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
    const matches = els.filter(el => {
      const t = (el.textContent || el.value || "").trim();
      return ${opts.exact ? `t === ${JSON.stringify(text)}` : `t.includes(${JSON.stringify(text)})`}
        && el.offsetParent !== null;
    });
    // 外側のコンテナではなく一番内側の要素をクリックする
    matches.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    const target = matches[0];
    if (!target) return false;
    target.click();
    return true;
  })()`);
  if (!ok) throw new Error(`テキスト "${text}" の要素が見つかりません`);
}

/**
 * セレクタの要素を JS の click() で押す。
 * (KOTのカスタムボタンは hidden input のため view.click の可視性チェックに落ちる)
 */
export async function clickSelector(view: WebViewLike, selector: string) {
  const ok = await view.evaluate(`(() => {
    const el = document.querySelector(${JSON.stringify(selector)});
    if (!el) return false;
    el.click();
    return true;
  })()`);
  if (!ok) throw new Error(`要素が見つかりません: ${selector}`);
}

export async function shot(view: WebViewLike, name: string) {
  const png = await view.screenshot();
  await Bun.write(`shots/${name}.png`, png);
}
