ARG BASE_IMAGE=node:20-alpine
FROM ${BASE_IMAGE}
WORKDIR /usr/src/app

# prepare system build deps for native modules
# include fonts so LibreOffice (used for DOCX→PDF) can render glyphs correctly
ARG INSTALL_EXTRAS=true
RUN if [ "$INSTALL_EXTRAS" = "true" ]; then \
  apk add python3 make g++ libreoffice fontconfig ttf-dejavu ttf-freefont; \
else \
  apk add python3 make g++; \
fi

# install dependencies
COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/
RUN npm ci --silent

# install netcat for wait loop
RUN apk add netcat-openbsd

# copy rest of app
COPY apps/api ./apps/api

WORKDIR /usr/src/app/apps/api

# generate Prisma client for TypeScript
RUN npx prisma generate

# build
RUN npm run build

# ensure entrypoint executable
RUN chmod +x ./docker-entrypoint.sh || true

USER node
EXPOSE 3001
ENTRYPOINT ["/usr/src/app/apps/api/docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
