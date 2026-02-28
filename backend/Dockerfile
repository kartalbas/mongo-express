FROM node:22-alpine AS build
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile
COPY . .
RUN yarn build

FROM node:22-alpine
RUN apk add --no-cache tini
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
VOLUME /data
EXPOSE 3000
USER 1001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]
