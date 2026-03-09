FROM nginx:alpine
RUN apk add --no-cache git
ARG CACHEBUST=1
RUN git clone https://github.com/joaoqueirozprof/hsq-portal.git /tmp/repo && \
    cp /tmp/repo/web/index.html /usr/share/nginx/html/index.html && \
    cp /tmp/repo/web/nginx.conf /etc/nginx/conf.d/default.conf && \
    rm -rf /tmp/repo
EXPOSE 80
