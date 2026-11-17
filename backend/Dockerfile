FROM node:20-alpine

WORKDIR /app

# Install sharp native dependencies on Alpine
RUN apk add --no-cache vips-dev

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Persistent lightweight JSON data directory (photos live in Cloudflare R2)
RUN mkdir -p /app/data

EXPOSE 4000

CMD ["npm", "run", "start"]
