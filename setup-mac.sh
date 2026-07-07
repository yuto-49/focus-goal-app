#!/bin/bash
set -e

echo "=== Focus Goal App — Mac Setup ==="
echo ""

command -v node >/dev/null 2>&1 || { echo "Node.js is required. Install from https://nodejs.org"; exit 1; }
command -v pod >/dev/null 2>&1 || { echo "CocoaPods is required. Run: sudo gem install cocoapods"; exit 1; }

echo "Installing npm dependencies..."
npm install

if [ ! -d "ios" ]; then
  echo "Generating iOS project..."
  npx @react-native-community/cli init FocusGoal --directory /tmp/rn-init-temp --version 0.79.2 --skip-install
  cp -r /tmp/rn-init-temp/ios ./ios
  rm -rf /tmp/rn-init-temp
  find ios -name "*.pbxproj" -exec sed -i '' 's/org.reactjs.native.example.FocusGoal/com.focusgoal.app/g' {} +
  echo "iOS project generated with bundle ID: com.focusgoal.app"
fi

echo "Installing CocoaPods dependencies..."
cd ios && pod install && cd ..

echo ""
echo "=== Setup complete! ==="
echo ""
echo "To run: npx react-native run-ios"
echo "Or open: open ios/FocusGoal.xcworkspace"
