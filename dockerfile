FROM node:24-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

EXPOSE 3000

# jalankan migrasi dulu, lalu start server
CMD ["sh", "-c", "npm run migrate:up && npm start"]