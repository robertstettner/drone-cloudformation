FROM kkarczmarczyk/node-yarn:6.9

WORKDIR /plugin

COPY . /plugin

ENV NODE_ENV production

RUN npm prune && yarn install

ENTRYPOINT node /plugin/index.js