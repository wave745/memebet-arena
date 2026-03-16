#!/usr/bin/env node

/**
 * Bulk Market Resolution Script
 *
 * This script resolves all expired markets and distributes rewards to winners.
 * Run this from the terminal to process all pending market resolutions.
 */

// Load environment variables
require('dotenv').config()

// Using built-in fetch (Node.js 18+)

async function bulkResolveMarkets() {
    console.log('🚀 Starting bulk market resolution...');
    console.log('⏳ This may take several minutes depending on the number of markets...');

    try {
        let response;

        // Try localhost first, fallback to production
        try {
            console.log('🌐 Trying localhost API...');
            response = await fetch('http://localhost:3000/api/activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'bulk_resolve_all'
                }),
                signal: AbortSignal.timeout(5000) // 5 second timeout
            });
            console.log('✅ Using localhost API');
        } catch (localError) {
            console.log('🌐 Localhost not available, trying production...');
            response = await fetch('https://trench-market.fun/api/activity', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    action: 'bulk_resolve_all'
                })
            });
        }

        console.log('📡 API Response Status:', response.status);
        console.log('📡 API Response Headers:', Object.fromEntries(response.headers.entries()));

        const result = await response.json();

        if (!response.ok) {
            console.error('❌ Bulk resolution failed:', result.error);
            process.exit(1);
        }

        console.log('✅ Bulk resolution completed!');
        console.log('📊 Results:', result.stats);
        console.log('');

        if (result.results && result.results.length > 0) {
            console.log('📋 Market Resolution Details:');
            result.results.forEach((item, index) => {
                if (item.status === 'resolved') {
                    console.log(`${index + 1}. ✅ ${item.token} - Resolved for $${item.marketCap.toLocaleString()}`);
                    console.log(`   TX: ${item.signature}`);
                } else {
                    console.log(`${index + 1}. ❌ ${item.token} - Failed: ${item.error}`);
                }
            });
        }

        console.log('');
        console.log('🎉 All expired markets have been resolved!');
        console.log('💰 Winners can now claim their rewards through the redeem function.');

    } catch (error) {
        console.error('❌ Script failed:', error.message);
        process.exit(1);
    }
}

// Run the script
bulkResolveMarkets();