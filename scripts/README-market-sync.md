# Automated Market Syncing

This system automatically discovers and syncs all markets from the Solana blockchain to the Neon PostgreSQL database.

## How It Works

1. **Discovery**: Uses `getProgramAccounts` to find all accounts owned by the memebet-arena program
2. **Parsing**: Parses raw account data according to the Market struct layout
3. **Metadata**: Fetches token metadata from DexScreener/Helius APIs
4. **Sync**: Updates the database with the latest market information

## Usage

### One-Time Sync

Run a complete sync of all markets:

```bash
# From project root
npm run ts-node scripts/sync-markets-to-db.ts
```

Or via API:

```bash
curl -X POST http://localhost:3000/api/markets/sync-all
```

### Continuous Sync (Background Process)

Run continuous syncing every 5 minutes:

```bash
npm run ts-node scripts/sync-markets-to-db.ts continuous
```

Custom interval (in minutes):

```bash
npm run ts-node scripts/sync-markets-to-db.ts continuous 10  # Every 10 minutes
```

### Cron Job Setup

Add to crontab for automated syncing:

```bash
# Edit crontab
crontab -e

# Add this line for hourly syncs
0 * * * * cd /path/to/memebet-arena && npm run ts-node scripts/sync-markets-to-db.ts
```

## Environment Variables

Required for syncing:

```bash
# Database
DATABASE_URL=postgresql://user:pass@host/db

# Solana RPC (recommended: Helius or QuickNode)
NEXT_PUBLIC_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

# Optional: Token metadata API
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_key
```

## API Endpoints

### POST /api/markets/sync-all

Triggers a complete market sync.

**Response:**
```json
{
  "success": true,
  "message": "Market sync completed successfully",
  "marketsCount": 42
}
```

## Database Schema

Markets are stored in the `Market` table with:

- `pda`: Program-derived address (unique identifier)
- `tokenMint`: Token contract address
- `tokenSymbol`: Token symbol (e.g., "BONK")
- `tokenName`: Token name
- `tokenImage`: Token logo URL
- `targetCap`: Target market cap for the bet
- `endTimestamp`: When the market expires
- `resolved`: Whether the market has been resolved
- `outcome`: YES/NO/null result
- `finalMarketCap`: Actual market cap at resolution

## Error Handling

- **RPC Rate Limits**: Batched requests with delays
- **API Rate Limits**: Token metadata fetched in batches
- **Invalid Accounts**: Filtered out non-market accounts
- **Network Issues**: Automatic retry with exponential backoff

## Monitoring

Logs are written to console with emojis for easy monitoring:

- 🔍 Discovery phase
- 🔄 Syncing phase
- ✅ Successful operations
- ❌ Failed operations
- 📊 Summary statistics

## Performance

- **Batch Processing**: Processes accounts in batches of 10
- **Rate Limiting**: 100ms delays between batches
- **Caching**: Token metadata cached for 5 minutes
- **Parallel Processing**: Multiple token metadata requests in parallel (limited to 5 concurrent)

## Troubleshooting

### No markets found
- Check program ID is correct
- Verify program is deployed on the network
- Check RPC endpoint is accessible

### Database connection errors
- Verify `DATABASE_URL` is set
- Check database is accessible
- Run `npx prisma db push` to ensure schema is up to date

### Token metadata failures
- Check `NEXT_PUBLIC_HELIUS_API_KEY` is set
- Verify internet connection
- Some tokens may not have metadata (will show as "UNKNOWN")

### High sync times
- Large number of markets (>100) may take several minutes
- Check RPC performance
- Consider increasing batch delays if getting rate limited