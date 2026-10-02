#!/bin/sh
# Downloads the original King Candy Crush SWF (as hosted by gamefools.com) into game/original/.
set -e
cd "$(dirname "$0")/.."
mkdir -p game/original
UA="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
curl -fsSL -A "$UA" -e "https://games2.gamefools.com/onlinegames/CandyCrush/index.php" \
  "https://games2.gamefools.com/onlinegames/CandyCrush/CandyCrush.swf" -o game/original/CandyCrush.swf
echo "expected sha256: b869e95d5c25dd5632f07dc45e749fd132f46247eb931a023cd49a1ad6973268"
shasum -a 256 game/original/CandyCrush.swf
