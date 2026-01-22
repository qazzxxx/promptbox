# Multi-stage Dockerfile
# Stage 1: Build Frontend
FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend and Final Image
FROM node:18-alpine
WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./
RUN npm install

# Copy backend source
COPY backend/ ./

# Copy built frontend to backend/static (where Express serves it)
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose port
EXPOSE 8000

# Run the application
CMD ["npm", "start"]
