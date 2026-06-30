#!/bin/bash
set -e

export FLUTTER_ROOT="$HOME/flutter"
export PUB_CACHE="$HOME/.pub-cache"

if [ ! -d "$FLUTTER_ROOT" ]; then
  echo "Downloading Flutter SDK 3.24.0..."
  curl -fsSL "https://storage.googleapis.com/flutter_infra_release/releases/stable/linux/flutter_linux_3.24.0-stable.tar.xz" -o /tmp/flutter.tar.xz
  mkdir -p "$FLUTTER_ROOT"
  tar xf /tmp/flutter.tar.xz -C "$FLUTTER_ROOT" --strip-components=1
  rm /tmp/flutter.tar.xz
fi

export PATH="$FLUTTER_ROOT/bin:$PATH"

git config --global --add safe.directory "$FLUTTER_ROOT"
git config --global --add safe.directory /vercel

flutter pub get
flutter build web --release --no-pub

echo "=== Build output ==="
ls -la build/web/
