FROM node:22-alpine AS build

WORKDIR /dockerbuild
COPY . .

RUN yarn install \
    && yarn build \
    && rm -rf /dockerbuild/lib/scripts

FROM node:22-alpine

# "localhost" doesn't mean much in a container, so we adjust our default to the common service name "mongo" instead
# (and make sure the server listens outside the container, since "localhost" inside the container is usually difficult to access)
ENV ME_CONFIG_MONGODB_URL="mongodb://mongo:27017"
ENV ME_CONFIG_MONGODB_ENABLE_ADMIN="true"
ENV VCAP_APP_HOST="0.0.0.0"

WORKDIR /opt/mongo-express

COPY --from=build /dockerbuild/build /opt/mongo-express/build/
COPY --from=build /dockerbuild/public /opt/mongo-express/public/
COPY --from=build /dockerbuild/lib /opt/mongo-express/lib/
COPY --from=build /dockerbuild/app.js /opt/mongo-express/
COPY --from=build /dockerbuild/config.default.js /opt/mongo-express/
COPY --from=build /dockerbuild/*.json /opt/mongo-express/
COPY --from=build /dockerbuild/.yarn /opt/mongo-express/.yarn/
COPY --from=build /dockerbuild/yarn.lock /opt/mongo-express/
COPY --from=build /dockerbuild/.yarnrc.yml /opt/mongo-express/
COPY --from=build /dockerbuild/.npmignore /opt/mongo-express/

RUN apk -U add --no-cache \
        bash \
        tini \
    && yarn workspaces focus --production

EXPOSE 8081

CMD ["/sbin/tini", "--", "yarn", "start"]
