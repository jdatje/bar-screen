#!/bin/sh
# Start go-librespot with ALSA straight to the USB sound card.
# The card is looked up by name on every start (card numbers can change);
# set AUDIO_DEVICE (e.g. "plughw:CARD=PCH,DEV=0") to override.
set -e
cp /etc/wexer/config.yml /config/config.yml

dev="${AUDIO_DEVICE:-}"
if [ -z "$dev" ] && [ -r /proc/asound/cards ]; then
  id=$(sed -n 's/^ *[0-9][0-9]* \[\([^] ]*\) *\]: USB-Audio.*/\1/p' /proc/asound/cards | head -n 1)
  [ -n "$id" ] && dev="plughw:CARD=$id,DEV=0"
fi
dev="${dev:-default}"
echo "Sound cards:"; cat /proc/asound/cards 2>/dev/null || true
echo "Playing to ALSA device: $dev"
echo "audio_device: \"$dev\"" >> /config/config.yml

exec /usr/bin/go-librespot --config_dir /config
