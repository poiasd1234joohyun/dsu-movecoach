# DSU 무브코치 — 작은 Node 서버 하나로 돈다(화면 + 기록 서버).
FROM node:20-alpine
WORKDIR /app
COPY package.json ./
# pg(PostgreSQL 연결 부품)만 설치한다. 설치에 실패해도 서버는 파일 저장으로 켜진다.
RUN npm install --omit=dev --no-audit --no-fund || true
COPY server.js index.html ./
COPY vendor ./vendor
COPY media ./media
ENV PORT=8000
EXPOSE 8000
RUN mkdir -p /app/data && chown -R node:node /app/data
USER node
CMD ["node", "server.js"]
