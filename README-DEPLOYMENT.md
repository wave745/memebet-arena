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
# No global installation needed - uses npx
# Just run the deployment script
./deploy.sh
```

Choose option 3 to deploy both apps automatically.

## 📋 Manual Deployment

### 1. Deploy Landing Page

```bash
cd landing
npm run build
npx vercel --prod
# Follow prompts to create new project
# Name: trenchmarket-landing
```

### 2. Deploy Main App

```bash
cd ..  # Back to root
npm run build
npx vercel --prod
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

### **Main App Project:**
```bash
# Solana RPC (Production - automatically detected)
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com

# Database (optional - for development only)
# DATABASE_URL=your_database_url

# Wallet Connect (optional)
NEXT_PUBLIC_WALLET_CONNECT_PROJECT_ID=your_project_id

# Other API keys as needed
```

## 🗄️ **Database Configuration**

**Current Setup:** In-memory storage (resets on deployments)

For production persistence, add one of these:

### **Option 1: Vercel Postgres**
```bash
# Add to environment variables
POSTGRES_URL=your_vercel_postgres_url

# Vercel will provide this automatically when you add Postgres
```

### **Option 2: PlanetScale**
```bash
DATABASE_URL=mysql://user:pass@host/db
```

### **Option 3: Supabase**
```bash
SUPABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_key
```

**Note:** Current implementation uses global in-memory storage for Vercel compatibility. Markets persist during the deployment but reset on redeploys. Add a database for full persistence.

### **Landing Page Project:**
```bash
# Minimal env vars needed
NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com
```

## ⚠️ **Critical: Wallet Configuration**

The wallet provider automatically detects production vs development:

- **Production** (`NODE_ENV=production`): Uses Mainnet + Mainnet RPC
- **Development** (`NODE_ENV=development`): Uses Devnet + Devnet RPC
- **Production** (`NODE_ENV=production`): Uses Mainnet + Mainnet RPC + Mainnet explorer links

**Included Wallets:**
- ✅ Phantom
- ✅ Solflare
- ✅ Backpack
- ✅ Coinbase Wallet
- ✅ Trust Wallet

**Environment Variables in Vercel:**
1. Go to Project Settings → Environment Variables
2. Add `NEXT_PUBLIC_RPC_URL=https://api.mainnet-beta.solana.com`
3. Vercel automatically sets `NODE_ENV=production`

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