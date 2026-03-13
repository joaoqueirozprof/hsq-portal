FROM nginx:alpine

# Copy all web files directly (no git clone needed)
COPY index.html /usr/share/nginx/html/index.html
COPY admin.html /usr/share/nginx/html/admin.html
COPY manifest.json /usr/share/nginx/html/manifest.json
COPY sw.js /usr/share/nginx/html/sw.js
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy icons
RUN mkdir -p /usr/share/nginx/html/icons
COPY icons/ /usr/share/nginx/html/icons/

# Copy mp4-muxer if exists
COPY mp4-muxer.min.js /usr/share/nginx/html/mp4-muxer.min.js

EXPOSE 80
