# Pinned to a stable release: "latest" is a development build
FROM ghcr.io/devgianlu/go-librespot:v0.10.5

# The config lives in the image; the /config volume keeps the Spotify login.
# start.sh copies the config in on every start (so changes in new releases
# take effect), picks the USB sound card and starts go-librespot.
COPY config.yml /etc/wexer/config.yml
COPY start.sh /usr/local/bin/start.sh

CMD ["/bin/sh", "/usr/local/bin/start.sh"]
