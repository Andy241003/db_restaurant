# Build stage
FROM node:20-alpine AS build

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (including dev dependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build arguments
ARG VITE_API_URL=https://travel.link360.vn
ARG NODE_ENV=production
ARG NODE_OPTIONS=--max-old-space-size=4096

# Set environment variables
ENV VITE_API_URL=${VITE_API_URL}
ENV NODE_ENV=${NODE_ENV}
ENV NODE_OPTIONS=${NODE_OPTIONS}

# Build the app
RUN npm run build

# Production stage
FROM nginx:1.25-alpine

# Copy built app to nginx
COPY --from=build /app/dist /usr/share/nginx/html

# Copy nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose port
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
