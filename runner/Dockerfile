# Playwright's image ships Chromium, Xvfb and fonts, for both amd64 and arm64 (Oracle free ARM VMs work).
FROM mcr.microsoft.com/playwright:v1.48.2-jammy

RUN apt-get update \
 && apt-get install -y --no-install-recommends pulseaudio pulseaudio-utils ffmpeg \
 && rm -rf /var/lib/apt/lists/*

ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 \
    DISPLAY=:99 \
    XDG_RUNTIME_DIR=/tmp/runtime-pwuser \
    NODE_ENV=production

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY tsconfig.json ./
COPY src ./src
COPY entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
 && mkdir -p /data/audio /secrets \
 && chown -R pwuser:pwuser /app /data

USER pwuser
ENTRYPOINT ["/entrypoint.sh"]
