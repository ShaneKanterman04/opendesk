FROM node:20-alpine
WORKDIR /usr/src/app

# prepare system build deps for native modules
RUN apk add --no-cache python3 make g++

COPY package.json package-lock.json* ./
RUN npm ci --silent

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
