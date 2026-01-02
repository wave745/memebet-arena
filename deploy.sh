#!/bin/bash

# Trenchmarket Deployment Script

echo "🚀 Trenchmarket Vercel Deployment"
echo "================================"
echo ""
echo "This will deploy both apps as separate Vercel projects:"
echo "- Landing Page → trench-market.fun"
echo "- Main App → arena.trench-market.fun"
echo ""
echo "This script uses npx to run Vercel CLI (no global install needed)"
echo ""

# Check if npx is available
if ! command -v npx &> /dev/null; then
    echo "❌ npx not found. Please install Node.js/npm first."
    exit 1
fi

echo "1. Deploy Landing Page (trench-market.fun)"
echo "2. Deploy Main App (arena.trench-market.fun)"
echo "3. Deploy Both Apps"
echo "4. Check Vercel Projects"
echo ""

read -p "Choose deployment option (1-4): " choice

case $choice in
    1)
        echo "🏠 Deploying Landing Page..."
        cd landing
        echo "📦 Building landing page..."
        npm run build

        if [ $? -eq 0 ]; then
            echo "☁️  Deploying to Vercel..."
            npx vercel --prod
            echo "✅ Landing page deployed!"
        else
            echo "❌ Build failed"
            exit 1
        fi
        ;;
    2)
        echo "🎯 Deploying Main App..."
        echo "📦 Building main app..."
        npm run build

        if [ $? -eq 0 ]; then
            echo "☁️  Deploying to Vercel..."
            npx vercel --prod
            echo "✅ Main app deployed!"
        else
            echo "❌ Build failed"
            exit 1
        fi
        ;;
    3)
        echo "🚀 Deploying Both Apps..."
        echo ""
        echo "🏠 Deploying Landing Page..."
        cd landing
        npm run build && npx vercel --prod
        echo "✅ Landing page deployed!"
        echo ""

        echo "🎯 Deploying Main App..."
        cd ..
        npm run build && npx vercel --prod
        echo "✅ Main app deployed!"
        echo ""
        echo "🎉 Both apps deployed successfully!"
        ;;
    4)
        echo "📋 Vercel Projects:"
        npx vercel ls
        ;;
    *)
        echo "❌ Invalid option"
        exit 1
        ;;
esac

echo ""
echo "📝 Next Steps:"
echo "1. Configure domains in Vercel dashboard:"
echo "   - Landing: trench-market.fun"
echo "   - Main App: arena.trench-market.fun"
echo "2. Copy environment variables to both projects"
echo "3. Test the deployments!"