#!/usr/bin/env bash
# Runs before EAS installs dependencies — use for environment setup

set -euo pipefail

echo "=== LightPay EAS Pre-Install ==="
echo "Node: $(node --version)"
echo "npm:  $(npm --version)"

# Enable Corepack for Yarn 4
corepack enable
corepack prepare yarn@4.6.0 --activate

echo "=== Pre-install complete ==="
