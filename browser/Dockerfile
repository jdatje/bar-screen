# The balena browser block, unchanged, plus one link: ALSA reads the shared
# mixer config that the spotify container writes, so game sound and music
# play through the same sound card at the same time.
FROM bh.cr/balenalabs/browser-amd64
RUN ln -sf /shared/asound.conf /etc/asound.conf
