FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ARG VITE_IDLE_LOGOUT_MINUTES=15
ARG VITE_SCOPE_RESET_GRACE_MINUTES=10
ENV VITE_IDLE_LOGOUT_MINUTES=${VITE_IDLE_LOGOUT_MINUTES}
ENV VITE_SCOPE_RESET_GRACE_MINUTES=${VITE_SCOPE_RESET_GRACE_MINUTES}

RUN npm run build

FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]

