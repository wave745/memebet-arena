#!/bin/bash

# 🚀 Trenchmarket Mainnet Program Deployment Script
# This script deploys the Anchor program to Solana mainnet

echo "🚀 Deploying Trenchmarket Program to Solana Mainnet"
echo "=================================================="
echo ""

# Add Solana CLI to PATH
export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found!"
    echo "Installing Solana CLI..."
    sh -c "$(curl -sSfL https://release.solana.com/v1.18.4/install)" || {
        echo "❌ Failed to install Solana CLI"
        exit 1
    }
    export PATH="$HOME/.local/share/solana/install/active_release/bin:$PATH"
fi

# Check if anchor CLI is installed
if ! command -v anchor &> /dev/null; then
    echo "❌ Anchor CLI not found!"
    echo "Install it with: npm i -g @coral-xyz/anchor-cli"
    exit 1
fi

echo "🔍 Checking current Solana configuration..."
solana config get

echo ""
echo "⚠️  IMPORTANT CHECKS:"
echo "1. Are you using the correct MAINNET wallet?"
echo "2. Do you have ~0.5-1 SOL in your wallet?"
echo "3. Have you backed up your private keys?"
echo ""

read -p "Continue with deployment? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
fi

echo ""
echo "🔄 Switching to mainnet..."
solana config set --url https://api.mainnet-beta.solana.com

echo ""
echo "💰 Checking mainnet wallet balance..."
MAINNET_BALANCE=$(solana balance 2>/dev/null | awk '{print $1}')

if [ -z "$MAINNET_BALANCE" ] || [ "$MAINNET_BALANCE" = "0" ]; then
    echo "❌ No SOL found on mainnet wallet!"
    echo ""
    echo "You need ~0.5-1 SOL on mainnet for deployment."
    echo ""
    echo "Options to get mainnet SOL:"
    echo "1. Transfer from devnet: Use a bridge or exchange"
    echo "2. Buy SOL on an exchange (Binance, Coinbase, etc.)"
    echo "3. Use mainnet faucet if available"
    echo ""
    echo "Current devnet balance: $(solana config set --url https://api.devnet.solana.com && solana balance && solana config set --url https://api.mainnet-beta.solana.com)"
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled - get mainnet SOL first"
        exit 1
    fi
else
    echo "✅ Mainnet balance: $MAINNET_BALANCE SOL"
    if (( $(echo "$MAINNET_BALANCE < 0.5" | bc -l) )); then
        echo "⚠️  Warning: Balance is low. Deployment costs ~0.1-0.5 SOL"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Deployment cancelled - insufficient funds"
            exit 1
        fi
    fi
fi

echo ""
echo "🚀 Deploying program to mainnet..."
echo "This will cost ~0.1-0.5 SOL..."
anchor deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Deployment successful!"
    echo ""
    echo "🔍 Verifying deployment..."
    solana program show 6fQsRy2d91RaaHZrd9ymmaQuR4bWDL7x5hD6WqpdgLMV

    echo ""
    echo "🎉 Program deployed to mainnet!"
    echo "📝 Program ID: 6fQsRy2d91RaaHZrd9ymmaQuR4bWDL7x5hD6WqpdgLMV"
    echo ""
    echo "🚀 Now redeploy your Vercel app:"
    echo "   ./deploy.sh"
    echo "   Choose option 2: Deploy Main App"
else
    echo ""
    echo "❌ Deployment failed!"
    echo "Check the error messages above and ensure you have enough SOL"
    exit 1
fi