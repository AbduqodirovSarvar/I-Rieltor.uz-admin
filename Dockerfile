# Admin panel: build the static site, then serve it with nginx (SPA fallback, API proxy). Build context: this folder.
#   docker build -t irieltor-admin .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY . .
RUN npx ng build --configuration docker

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY proxy-common.conf /etc/nginx/proxy-common.conf
COPY --from=build /app/dist/I-Rieltor.uz-admin/browser /usr/share/nginx/html
EXPOSE 80
