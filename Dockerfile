# Dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy dependency files first (better layer caching)
COPY package*.json ./
RUN npm install --production

# Copy source
COPY . .

# Code Engine expects port 8080 by default
EXPOSE 8080

CMD ["node", "src/server.js"]
