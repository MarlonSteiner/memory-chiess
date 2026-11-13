#!/bin/sh
# Builds the app for the iPhone 17 Pro simulator, then installs and opens it.
set -e
cd "$(dirname "$0")"
node copy-web.mjs
npx cap sync ios
SIM=$(xcrun simctl list devices available | grep -m1 "iPhone 17 Pro (" | grep -oE "[0-9A-F-]{36}")
xcrun simctl boot "$SIM" 2>/dev/null || true
xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Debug \
  -destination "id=$SIM" -derivedDataPath ios/App/build/dd -scmProvider system build 2>&1 | grep -E "error:|Fetching|Resolv|Downloading|BUILD|\*\*"
xcrun simctl install "$SIM" ios/App/build/dd/Build/Products/Debug-iphonesimulator/App.app
xcrun simctl launch "$SIM" io.github.marlonsteiner.memorychiess
echo "BUILD-SIM DONE"
