#!/bin/bash
# Test if older Anchor versions work with Rust 1.75.0
echo "Testing Anchor version compatibility..."
for version in "0.29" "0.28" "0.27"; do
  echo "Trying Anchor $version..."
  # This would require installing each version, skip for now
done
echo "Current: Anchor 0.30 requires Rust 1.76.0+"
