#!/bin/sh
# FFDec (JPEXS) CLI wrapper. Needs brew openjdk.
exec /opt/homebrew/opt/openjdk/bin/java -Xmx2g -jar "$(dirname "$0")/ffdec/ffdec.jar" "$@"
