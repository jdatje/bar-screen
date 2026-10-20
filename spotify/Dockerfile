# Pinned to a stable release: "latest" is a development build
FROM ghcr.io/devgianlu/go-librespot:v0.10.5

# The config lives in the image; the /config volume keeps the Spotify login.
# Copy the config in on every start so changes in new releases take effect.
COPY config.yml /etc/wexer/config.yml

# The image has no ENTRYPOINT, so the command must start the binary itself.
CMD ["/bin/sh", "-c", "cp /etc/wexer/config.yml /config/config.yml && exec /usr/bin/go-librespot --config_dir /config"]
