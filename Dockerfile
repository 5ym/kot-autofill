FROM oven/bun:1.4

# Bun.WebView のバックエンドとして Chromium が必要。
# コンテナ内にディスプレイが無いため xvfb 上で動かす。
# fonts-noto-cjk はスクリーンショットの日本語表示用。
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    xvfb \
    fonts-noto-cjk \
    && rm -rf /var/lib/apt/lists/*

# コンテナ内では Chromium のサンドボックスが使えないため --no-sandbox を強制する
RUN printf '#!/bin/sh\nexec /usr/bin/chromium --no-sandbox --disable-dev-shm-usage "$@"\n' \
      > /usr/local/bin/google-chrome \
    && chmod +x /usr/local/bin/google-chrome \
    && ln -s /usr/local/bin/google-chrome /usr/local/bin/chrome

WORKDIR /app
COPY package.json entrypoint.sh ./
COPY src ./src
RUN chmod +x entrypoint.sh

ENTRYPOINT ["/app/entrypoint.sh"]
CMD ["--help"]
