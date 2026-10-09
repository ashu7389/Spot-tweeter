FROM node:20-alpine
ENV NODE_ENV=production
WORKDIR /app

# Install only production dependencies (nodemon is a devDependency)
COPY package*.json ./
RUN npm ci --omit=dev

COPY . .

# server.js and config/upload.js use path.resolve("uploads") -> /app/uploads
RUN mkdir -p /app/uploads && chown -R node:node /app
USER node

EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||5000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
