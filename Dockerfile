FROM node:22-slim@sha256:83f487e0a63425e5b4d146fb5e5be574bcbe1b7b843d3ebafdd95eaf7767a7e5

WORKDIR /usr/src/app

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev

COPY prisma ./prisma
COPY src ./src
COPY server.ts ./
COPY prisma.config.ts ./
# Supabase CA bundle, read at runtime via DB_SSL_CA_PATH to verify the DB certificate.
COPY certs ./certs

RUN npx prisma generate

# Run as the unprivileged "node" user shipped by the base image. chown the whole
# workdir so tsx/node can write their caches (node_modules/.cache) at runtime.
RUN chown -R node:node /usr/src/app

EXPOSE 8080

USER node

CMD ["npm", "run", "start"]
