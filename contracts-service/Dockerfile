FROM node:18-alpine

WORKDIR /app

RUN apk add --no-cache git

COPY package.json package-lock.json* ./
RUN npm ci || npm install

COPY . .

RUN npx hardhat compile

CMD ["npx", "hardhat", "node"]
