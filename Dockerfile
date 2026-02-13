FROM denoland/deno:alpine-1.44.0

WORKDIR /app

COPY . .

RUN deno cache server.ts

EXPOSE 8080

CMD ["deno", "run", "--allow-net", "--allow-env", "server.ts"]
