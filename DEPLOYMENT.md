# Trenchmarket Deployment Guide

This repository contains two separate Next.js applications for production deployment:

## 📁 Project Structure

```
/home/caesa/memebet-arena/
├── landing/          # Landing page app (trench-market.fun)
├── app/             # Main application (arena.trench-market.fun)
├── components/      # Shared UI components
├── lib/            # Shared utilities
└── public/         # Shared assets
```

## 🌐 Production Setup

### 1. Landing Page (`trench-market.fun`)

**Location:** `/landing/` directory
**Purpose:** Marketing landing page with social links

```bash
# Deploy landing page
cd landing
npm run build
npm run start
# Deploy to: trench-market.fun
```

### 2. Main App (`arena.trench-market.fun`)

**Location:** Root directory
**Purpose:** Full application with feeds, wallet, etc.

```bash
# Deploy main app
npm run build
npm run start
# Deploy to: arena.trench-market.fun
```

## 🚀 Deployment Options

### Option A: Vercel (Recommended)
```bash
# Landing page
cd landing
vercel --prod

# Main app
cd ..
vercel --prod
```

### Option B: Docker
```bash
# Create Dockerfile for each app
# Deploy containers to your hosting platform
```

### Option C: Manual Server
```bash
# Build and serve each app separately
# Configure nginx/apache for domain routing
```

## 🔗 Domain Configuration

### trench-market.fun
- Serves: `landing/` app
- Button redirects to: `https://arena.trench-market.fun`

### arena.trench-market.fun
- Serves: Main app (`app/` routes)
- Category filtering works within subdomain

## ✅ Features

- ✅ Separate landing page with premium design
- ✅ Full app with wallet, feeds, categories
- ✅ Social links to Discord & X
- ✅ Responsive design
- ✅ Optimized builds

## 🧪 Testing

```bash
# Test landing page
cd landing && npm run dev  # Runs on port 3001

# Test main app
npm run dev  # Runs on port 3000
```

## 📝 Notes

- Landing page has minimal dependencies for fast loading
- Main app includes all features (wallet, database, etc.)
- Shared components are duplicated for independence
- Update social links in both apps if needed