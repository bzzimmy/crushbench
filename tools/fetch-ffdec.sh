#!/bin/sh
# Downloads JPEXS Free Flash Decompiler (CLI) into tools/ffdec/. Needs Java: brew install openjdk
set -e
cd "$(dirname "$0")"
VER=26.3.0
curl -fsSL -o ffdec.zip "https://github.com/jindrapetrik/jpexs-decompiler/releases/download/version${VER}/ffdec_${VER}.zip"
rm -rf ffdec && unzip -q ffdec.zip -d ffdec && rm ffdec.zip
./ffdec.sh -help >/dev/null && echo "ffdec ok"
