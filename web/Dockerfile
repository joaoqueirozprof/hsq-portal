FROM nginx:alpine
RUN apk add --no-cache git
ARG CACHEBUST=1
RUN git clone https://github.com/joaoqueirozprof/hsq-portal.git /tmp/repo && \
    cp /tmp/repo/web/index.html /usr/share/nginx/html/index.html && \
    cp /tmp/repo/web/admin.html /usr/share/nginx/html/admin.html && \
    cp /tmp/repo/web/manifest.json /usr/share/nginx/html/manifest.json && \
    cp /tmp/repo/web/sw.js /usr/share/nginx/html/sw.js && \
    mkdir -p /usr/share/nginx/html/icons && \
    cp /tmp/repo/web/icons/* /usr/share/nginx/html/icons/ && \
    cp /tmp/repo/web/nginx.conf /etc/nginx/conf.d/default.conf && \
    rm -rf /tmp/repo
EXPOSE 80
