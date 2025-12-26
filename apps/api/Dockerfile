FROM node:20-alpine
WORKDIR /usr/src/app

# prepare system build deps for native modules
RUN apk add --no-cache python3 make g++

# install dependencies
COPY package.json package-lock.json* ./
RUN npm ci --silent

# install netcat for wait loop
RUN apk add --no-cache netcat-openbsd

# copy rest of app
COPY . .

# generate Prisma client for TypeScript
RUN npx prisma generate

# build
RUN npm run build

# ensure entrypoint executable
RUN chmod +x ./docker-entrypoint.sh || true

USER node
EXPOSE 3001
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]
CMD ["node", "dist/src/main.js"]
