FROM node:20-alpine
WORKDIR /usr/src/app

# prepare system build deps for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json ./
COPY apps/web/package.json ./apps/web/
RUN npm ci --silent

COPY apps/web ./apps/web
RUN cd apps/web && npm run build

WORKDIR /usr/src/app/apps/web
EXPOSE 3000
CMD ["npm", "start"]
