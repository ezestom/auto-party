`vj.webm` is a silent, synthetic four-second test pattern used to verify VJ synchronization. It contains no third-party media.

Generated with FFmpeg: `ffmpeg -f lavfi -i testsrc=size=160x90:rate=12 -t 4 -c:v libvpx -b:v 100k -g 12 -pix_fmt yuv420p -an vj.webm`.
