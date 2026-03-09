FROM nginx:alpine
RUN apk add --no-cache git
RUN git clone https://github.com/joaoqueirozprof/hsq-portal.git /tmp/repo
COPY nginx.conf /etc/nginx/conf.d/default.conf
RUN cp /tmp/repo/web/index.html /usr/share/nginx/html/index.html && \
    cp /tmp/repo/web/nginx.conf /etc/nginx/conf.d/default.conf && \
    rm -rf /tmp/repo
EXPOSE 80
