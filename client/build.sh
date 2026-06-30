#!/bin/bash
set -e

FLUTTER_CACHE="$HOME/.cache/flutter"
FLUTTER_VERSION="3.24.0"

if [ ! -d "$FLUTTER_CACHE" ]; then
  echo "Downloading Flutter SDK $FLUTTER_VERSION..."
  curl -fsSL "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_$FLUTTER_VERSION-stable.tar.xz" -o /tmp/flutter.tar.xz
  mkdir -p "$FLUTTER_CACHE"
  tar xf /tmp/flutter.tar.xz -C "$FLUTTER_CACHE" --strip-components=1
  rm /tmp/flutter.tar.xz
  "$FLUTTER_CACHE/bin/flutter" config --enable-web
fi

export PATH="$FLUTTER_CACHE/bin:$FLUTTER_CACHE/bin/cache/dart-sdk/bin:$PATH"

flutter pub get
flutter build web --release
