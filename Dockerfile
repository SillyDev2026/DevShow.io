# Deploy with a persistent volume mounted to /data and CORS_ORIGINS configured.
FROM node:24-alpine
ENV NODE_ENV=production PORT=3000 DB_PATH=/data/devshow.sqlite
WORKDIR /app
COPY --chown=node:node . .
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server/index.js"]
