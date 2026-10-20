FROM bh.cr/balenalabs/audio-amd64

# The block's startup runs amixer to switch on and set the volume of the
# built-in Intel (HDA) card. On this PC that write is refused ("Operation not
# permitted"), the startup script exits on the error and PulseAudio never
# starts, so the container restarts forever. Wrap amixer so a refused write
# is logged but no longer fatal.
RUN set -e; \
    real="$(command -v amixer)"; \
    mv "$real" "$real.real"; \
    printf '#!/bin/sh\n"%s.real" "$@" || { echo "amixer $* failed (ignored)" >&2; true; }\n' "$real" > "$real"; \
    chmod +x "$real"
