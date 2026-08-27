FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code and Prisma schema
COPY . .

# Generate Prisma Client
RUN npx prisma generate

EXPOSE 5000

CMD ["node", "src/server.js"]
