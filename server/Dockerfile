# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY . .

ENV NODE_ENV=production
ENV HOST=0.0.0.0

EXPOSE 8080

CMD ["npm", "start"]
