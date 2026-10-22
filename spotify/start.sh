#!/bin/sh
# Start go-librespot on the USB sound card.
# The card is looked up by name on every start (card numbers can change);
# set AUDIO_DEVICE (e.g. "plughw:CARD=PCH,DEV=0") to override.
#
# The card is shared with the browser (game sound) through an ALSA "dmix"
# mixer: this script writes the mixer config to the shared audio-config
# volume, which the browser container reads as its /etc/asound.conf. Both
# containers run with ipc: host so the mixer's shared memory is shared.
set -e
cp /etc/wexer/config.yml /config/config.yml

dev="${AUDIO_DEVICE:-}"
id=""
if [ -z "$dev" ] && [ -r /proc/asound/cards ]; then
  id=$(sed -n 's/^ *[0-9][0-9]* \[\([^] ]*\) *\]: USB-Audio.*/\1/p' /proc/asound/cards | head -n 1)
fi
echo "Sound cards:"; cat /proc/asound/cards 2>/dev/null || true

if [ -n "$id" ]; then
  mkdir -p /shared
  {
    echo "# Written by the spotify container on start: one sound card, mixed"
    echo "pcm.wexermix {"
    echo "  type dmix"
    echo "  ipc_key 4242"
    echo "  ipc_key_add_uid false"
    echo "  ipc_perm 0666"
    echo "  slave {"
    echo "    pcm \"hw:CARD=$id,DEV=0\""
    echo "    rate 48000"
    echo "    channels 2"
    echo "    period_size 1024"
    echo "    buffer_size 8192"
    echo "  }"
    echo "}"
    echo "pcm.wexer { type plug slave.pcm \"wexermix\" }"
    echo "pcm.!default { type plug slave.pcm \"wexermix\" }"
    echo "ctl.!default { type hw card $id }"
  } > /shared/asound.conf
  cp /shared/asound.conf /etc/asound.conf
  dev="wexer"
fi
dev="${dev:-default}"
echo "Playing to ALSA device: $dev"
echo "audio_device: \"$dev\"" >> /config/config.yml

exec /usr/bin/go-librespot --config_dir /config
