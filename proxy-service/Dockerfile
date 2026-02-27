FROM alpine:latest

WORKDIR /app

RUN apk add --no-cache ca-certificates

COPY mihomo /app/mihomo
COPY config.yaml /app/config.yaml

RUN chmod +x /app/mihomo

EXPOSE 7897 1080

CMD ["./mihomo", "-d", "."]
