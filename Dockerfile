FROM node:10.11-slim

WORKDIR /plugin

COPY package.json .

ENV NODE_ENV production

RUN npm prune && yarn install

COPY . .

ENTRYPOINT node /plugin/index.js