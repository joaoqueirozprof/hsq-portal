FROM node:20-alpine

WORKDIR /app

# Copy package files first for better Docker layer caching
COPY package.json ./
RUN npm install --production

# Copy source code
COPY src/ ./src/

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:4080/api/health || exit 1

EXPOSE 4080

CMD ["node", "src/index.js"]
