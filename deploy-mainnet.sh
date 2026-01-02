#!/bin/bash

# 🚀 Trenchmarket Mainnet Program Deployment Script
# This script deploys the Anchor program to Solana mainnet

echo "🚀 Deploying Trenchmarket Program to Solana Mainnet"
echo "=================================================="
echo ""

# Check if solana CLI is installed
if ! command -v solana &> /dev/null; then
    echo "❌ Solana CLI not found!"
    echo "Install it with: sh -c \"\$(curl -sSfL https://release.solana.com/v1.18.4/install)\""
    exit 1
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
echo "💰 Checking wallet balance..."
solana balance

echo ""
read -p "Balance looks good? Continue with deployment? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Deployment cancelled"
    exit 1
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