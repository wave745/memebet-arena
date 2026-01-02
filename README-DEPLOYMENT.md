# 🚀 Trenchmarket Vercel Deployment

Deploy Trenchmarket with separate landing page and main application to different domains.

## 📁 Project Structure

```
/home/caesa/memebet-arena/
├── landing/          # 🏠 Landing page app (trench-market.fun)
├── app/             # 🎯 Main application routes (/app)
├── components/      # Shared UI components
├── vercel.json      # Main app Vercel config
└── deploy.sh        # Deployment script
```

## 🌐 Domains

- **`trench-market.fun`** → Landing page (marketing site)
- **`arena.trench-market.fun`** → Main app (full application)

## 🚀 Quick Deploy

```bash
# Make sure Vercel CLI is installed
npm i -g vercel

# Run deployment script
./deploy.sh
```

Choose option 3 to deploy both apps automatically.

## 📋 Manual Deployment

### 1. Deploy Landing Page

```bash
cd landing
npm run build
vercel --prod
# Follow prompts to create new project
# Name: trenchmarket-landing
```

### 2. Deploy Main App

```bash
cd ..  # Back to root
npm run build
vercel --prod
# Follow prompts to create new project
# Name: trenchmarket-app
```

## ⚙️ Domain Configuration

### In Vercel Dashboard:

1. **Landing Page Project:**
   - Go to Settings → Domains
   - Add: `trench-market.fun`
   - Set as primary domain

2. **Main App Project:**
   - Go to Settings → Domains
   - Add: `arena.trench-market.fun`
   - Set as primary domain

## 🔧 Environment Variables

Copy these environment variables to **both** Vercel projects:

```bash
# Database
DATABASE_URL=your_database_url

# Solana
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Wallet Connect
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Other API keys...
```

## 🧪 Testing

### Local Testing:
```bash
# Landing page
cd landing && npm run dev  # localhost:3001

# Main app
npm run dev  # localhost:3000/app
```

### Production Testing:
- `https://trench-market.fun` → Landing page
- `https://arena.trench-market.fun/app` → Main app

## ✅ Features

- ✅ Separate landing page with premium design
- ✅ Full app with wallet integration and feeds
- ✅ Social links to Discord & X
- ✅ Category filtering works within main app
- ✅ Responsive design for all devices

## 🔗 Navigation Flow

```
trench-market.fun (Landing)
    ↓ [Enter the Trench button]
arena.trench-market.fun/app (Main App)
    ↓ [Category filters stay within app]
arena.trench-market.fun/app?category=live
```

## 📞 Support

If deployment fails, check:
1. Vercel CLI is installed: `vercel --version`
2. You're logged in: `vercel login`
3. Environment variables are set in Vercel dashboard
4. Domains are properly configured