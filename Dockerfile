FROM denoland/deno:alpine-2.0.0

WORKDIR /app

COPY . .

RUN deno cache main.ts

CMD ["deno", "run", "--unstable-kv", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "main.ts"]
