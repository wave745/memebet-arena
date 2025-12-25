# Trenchmarket - Complete System Documentation

---

## I. ARCHITECTURE OVERVIEW

```plaintext
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js)                       │
│  app/page.tsx, app/market/[id]/page.tsx, components/*           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      INDEXER / API (Future)                      │
│  Reads on-chain data, caches for UI performance                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 SOLANA PROGRAM (Anchor/Rust)                     │
│  programs/memebet-arena/src/lib.rs                              │
│  - create_market, place_bet, resolve_market, redeem             │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│                      RESOLVER BOT (Node.js)                      │
│  scripts/resolver-bot.ts                                        │
│  Fetches DexScreener → Computes VWAP → Submits resolution       │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │
┌─────────────────────────────────────────────────────────────────┐
│                    DEXSCREENER API (External)                    │
│  Price data, volume, circulating supply                         │
└─────────────────────────────────────────────────────────────────┘
```

---

## II. FILE STRUCTURE

```plaintext
memebet-arena/
├── app/
│   ├── layout.tsx              # Root layout, WalletProvider wrapper
│   ├── page.tsx                # Home page - market feed
│   ├── globals.css             # Dark theme styling
│   └── market/
│       └── [id]/
│           └── page.tsx        # Market detail page - betting interface
│
├── components/
│   ├── top-bar.tsx             # Header: logo, search, wallet, filters
│   ├── search-modal.tsx        # Search overlay (opens on "/" or click)
│   ├── market-feed.tsx        # Grid of market cards with filtering
│   ├── market-card.tsx         # Individual market card component
│   ├── bet-section.tsx         # Betting form (YES/NO buttons, amount input)
│   └── wallet-provider.tsx     # Wallet context (Phantom integration)
│
├── programs/
│   └── memebet-arena/
│       └── src/
│           ├── lib.rs          # Anchor program - 4 instructions
│           └── errors.rs       # Custom error codes
│
├── scripts/
│   └── resolver-bot.ts         # Oracle bot - fetches prices, resolves markets
│
├── tests/
│   ├── memebet-arena.ts        # Adversarial program tests
│   ├── oracle-abuse.ts         # Oracle edge case tests
│   └── tsconfig.json           # TypeScript config for tests
│
├── Anchor.toml                 # Anchor configuration (Devnet)
├── Cargo.toml                  # Rust dependencies
└── tsconfig.json               # Next.js TypeScript config
```

---

## III. FRONTEND COMPONENTS

**1. WalletProvider (`components/wallet-provider.tsx`)**

- React context for wallet state
- Phantom wallet detection and connection
- Exposes: `connected`, `publicKey`, `balance`, `connect()`, `disconnect()`
- Currently uses `window.solana` - swap with `@solana/wallet-adapter` for production

**2. TopBar (`components/top-bar.tsx`)**

- Logo: "Trenchmarket" + "Solana Prediction Markets"
- Search bar (opens SearchModal on click or "/" keypress)
- Category filters: All, Hot, New
- Wallet connect button / connected state display

**3. SearchModal (`components/search-modal.tsx`)**

- Opens on search bar click or "/" keyboard shortcut
- Contains search input and BROWSE section (Hot, New filters)
- Closes on Escape, backdrop click, or filter selection

**4. MarketFeed (`components/market-feed.tsx`)**

- Displays grid of MarketCard components
- Filters by search query and category
- Empty state when no markets match
- Accepts `markets` array as prop (currently empty, ready for real data)

**5. MarketCard (`components/market-card.tsx`)**

- Displays: question, image, outcomes with probability bars
- Shows volume in SOL and time remaining
- Links to `/market/[id]` detail page
- Probability calculated as: `yes_pool / (yes_pool + no_pool)`

**6. BetSection (`components/bet-section.tsx`)**

- Input field for SOL amount
- Shows current price, implied probability, potential return
- YES/NO buttons for placing bets
- After bet: buttons disable, shows position confirmation
- Ready to call `place_bet` instruction

**7. Market Detail Page (`app/market/[id]/page.tsx`)**

- Two-column layout: outcomes list (left), bet form (right)
- Resolution timer with urgency states
- Fetches market by ID (currently returns null, ready for real data)

---

## IV. SOLANA PROGRAM (Anchor)

**File: `programs/memebet-arena/src/lib.rs`**

### Account Structures

```rust
// Market - immutable after creation
pub struct Market {
    pub market_id: u64,
    pub token_mint: Pubkey,        // Memecoin mint address
    pub target_market_cap: u64,    // Target in USD (no decimals)
    pub end_timestamp: i64,        // Unix timestamp
    pub yes_pool: u64,             // Lamports in YES pool
    pub no_pool: u64,              // Lamports in NO pool
    pub resolved: bool,
    pub outcome: Option<bool>,     // true = YES won, false = NO won
}

// Position - one per bet
pub struct Position {
    pub market: Pubkey,
    pub user: Pubkey,
    pub outcome: bool,             // true = bet YES, false = bet NO
    pub amount: u64,               // Lamports
    pub claimed: bool,
}
```

**Note:** Accounts use standard Anchor account derivation. No explicit `bump` fields are stored in the account data structures.

### Instructions

**1. create_market**

- Creates new market with immutable rules
- PDA seed: `["market", market_id]` (derived automatically by Anchor)
- Validates: `end_timestamp > now`, `target_market_cap > 0`
- Initializes pools to 0
- **Errors:** `InvalidEndTimestamp` if timestamp is in the past

**2. place_bet**

- Transfers SOL from user to market escrow
- Creates Position account (PDA: `["position", market, user, outcome]`)
- Updates yes_pool or no_pool
- Rejects if: market resolved, market expired, amount is zero
- **Errors:** `InvalidBetAmount` if amount is 0, `MarketResolved`, `MarketExpired`

**3. resolve_market**

- Permissionless - anyone can call
- Requires: `now >= end_timestamp`, market not already resolved
- Takes `final_market_cap` as input (u64)
- Applies rule: `>= target` = YES wins, else NO wins
- Sets `resolved = true`, `outcome = Some(result)`
- **Errors:** `AlreadyResolved`, `MarketNotExpired` (if called before end_timestamp)

**4. redeem**

- User claims winning position
- Calculates payout: `user_amount + (user_share * losing_pool)`
- Transfers SOL from escrow to user
- Sets `claimed = true`
- Rejects if: not resolved, wrong outcome, already claimed
- **Errors:** `MarketNotResolved`, `PositionNotWinner`, `PositionAlreadyClaimed`, `NoOutcome`, `Overflow`, `InvalidPool`

### Error Codes

All error codes are defined in `programs/memebet-arena/src/errors.rs`:

```rust
pub enum MemeBetError {
    MarketResolved,           // Market already resolved (betting rejected)
    MarketExpired,            // Market has expired (betting rejected)
    AlreadyResolved,          // Market already resolved (double resolution)
    MarketNotEnded,           // Market has not ended yet (legacy, kept for compatibility)
    MarketNotResolved,        // Market not resolved (redemption rejected)
    AlreadyClaimed,           // Position already claimed (legacy)
    UserDidNotWin,            // User did not win (legacy)
    NoOutcome,                // No outcome set
    Overflow,                 // Overflow error
    InvalidPool,              // Invalid pool (division by zero)
    InvalidEndTimestamp,      // End timestamp must be in the future
    InvalidBetAmount,         // Bet amount must be greater than zero
    MarketNotExpired,         // Market has not expired yet (resolution rejected)
    PositionNotWinner,        // Position did not win
    PositionAlreadyClaimed,   // Position already claimed
}
```

---

## V. RESOLVER BOT

**File: `scripts/resolver-bot.ts`**

**Purpose:** Fetch real price data, compute VWAP, submit resolution

**Flow:**

1. Fetch unresolved markets from indexer (placeholder endpoint)
2. For each market past `end_timestamp`:
   - Call DexScreener API for token data
   - Get 5-minute candles for last hour
   - Filter candles within 10-minute window before `end_timestamp`
   - Compute VWAP: `sum(close * volume) / sum(volume)`
   - Get circulating supply from DexScreener
   - Calculate market cap: `vwap * supply`
3. Submit `resolve_market` transaction with `final_market_cap` (u64)
4. Exit

**Key Functions:**

- `fetchDexScreenerData(tokenAddress)` - Gets token info from API
- `computeVWAP(candles, endTimestamp, windowMinutes)` - 10-minute VWAP calculation
- `resolveMarket(program, market, resolver)` - Submits transaction with `final_market_cap`

**Safety Rules:**

- Returns null if zero volume in window (cannot determine price)
- Returns null if supply missing/invalid
- Sharp cutoff at `end_timestamp` - post-end trades ignored

**Important:** The `resolve_market` instruction takes `final_market_cap: u64`, not `outcome: bool`. The program computes the outcome internally based on the rule: `final_market_cap >= target_market_cap`.

---

## VI. TEST SUITES

**File: `tests/memebet-arena.ts`** - Program Tests

1. **Market Creation Invariants**
   - Valid market creation
   - Rejects past timestamps (`InvalidEndTimestamp`)
   - Rejects duplicate market IDs
   - Pools start at zero
   - Target market cap is immutable

2. **Betting Logic Abuse**
   - Valid YES/NO bets
   - Rejects zero lamport bets (`InvalidBetAmount`)
   - Allows same wallet to bet both sides (different positions)
   - Rejects duplicate bets (same wallet, same outcome)

3. **Pool Math Consistency**
   - Pool totals equal escrow balance
   - Implied probability matches on-chain math
   - No rounding loss accumulates

4. **Resolution Finality**
   - Rejects resolution before end_timestamp (`MarketNotExpired`)
   - Accepts resolution after end_timestamp (permissionless)
   - Rejects second resolution attempt (`AlreadyResolved`)
   - Outcome is locked forever

5. **Redemption Brutality**
   - Rejects redemption before resolution (`MarketNotResolved`)
   - Rejects losing position redemption (`PositionNotWinner`)
   - Allows winning position redemption with correct payout
   - Rejects double redemption (`PositionAlreadyClaimed`)

6. **Expired Market Betting Rejection**
   - Rejects bet on expired market
   - Rejects bet on resolved market

**File: `tests/oracle-abuse.ts`** - Oracle Edge Cases

1. Zero-volume window handling
2. Single-trade manipulation resistance
3. Missing/invalid supply rejection
4. Time skew enforcement
5. Double-resolver race condition
6. Market cap edge (exact equality)

---

## VII. CONFIGURATION FILES

**Anchor.toml**

```toml
[programs.devnet]
memebet_arena = "11111111111111111111111111111111"  # Placeholder - update after deploy

[provider]
cluster = "devnet"
wallet = "~/.config/solana/id.json"

[scripts]
test = "yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/**/*.ts"
```

**Cargo.toml**

- Anchor framework v0.30
- anchor-lang, anchor-spl dependencies

**tests/tsconfig.json**

- Separate config for Mocha/Anchor tests
- ES2020 target, CommonJS modules

---

## VIII. WHAT'S WIRED VS WHAT'S NOT

**Wired (Ready):**

- ✅ UI components and layout
- ✅ Wallet context structure
- ✅ Program instructions and accounts
- ✅ Error codes and validations
- ✅ Resolver bot logic structure
- ✅ Test suites

**Not Wired (Needs Connection):**

- ❌ UI → Program calls (need Anchor client in frontend)
- ❌ Indexer API (need to build or use Helius/Shyft)
- ❌ Real wallet adapter (swap mock for `@solana/wallet-adapter`)
- ❌ Environment variables (program ID, RPC endpoint)
- ❌ Resolver bot program connection (needs IDL import)

---

## IX. DEPLOYMENT STEPS (When Ready)

1. **Deploy Program to Devnet**

```bash
anchor build
anchor deploy --provider.cluster devnet
```

2. **Update Program ID**

- Copy program ID from deploy output
- Update `Anchor.toml` and `declare_id!()` in `lib.rs`
- Rebuild: `anchor build`

3. **Run Tests**

```bash
anchor test --provider.cluster devnet
```

4. **Configure Frontend**

- Add program ID to environment variables
- Add Devnet RPC endpoint
- Install `@solana/wallet-adapter-react` and related packages
- Wire up Anchor client in components

5. **Run Resolver Bot**

```bash
# Set environment variables
export RPC_URL="https://api.devnet.solana.com"
export PROGRAM_ID="<your-program-id>"
export RESOLVER_KEY="<resolver-keypair-json>"
export INDEXER_URL="http://localhost:3001"

# Run bot
npx ts-node scripts/resolver-bot.ts
```

---

## X. DESIGN DECISIONS (Immutable)

| Decision | Choice | Why |
|----------|--------|-----|
| Network | Devnet | Safe iteration, no reputation damage |
| Resolver Authority | Permissionless | No single point of failure |
| Resolution Metric | Market Cap | Harder to spoof than price/liquidity |
| Resolution Method | 10-min VWAP | Smooths manipulation |
| Resolution Rule | >= target = YES | Deterministic, no gray area |
| Pool Model | Pari-mutuel | No insolvency risk |
| Position Model | One per bet | Simple, auditable |
| Error Handling | Explicit error codes | Clear failure modes for debugging |

---

## XI. RECENT CHANGES (Code-Doc Alignment)

**Fixed Issues:**

1. ✅ Added missing error codes: `InvalidEndTimestamp`, `InvalidBetAmount`, `MarketNotExpired`, `PositionNotWinner`, `PositionAlreadyClaimed`
2. ✅ Added validation in `create_market` for past timestamps
3. ✅ Added validation in `place_bet` for zero amount bets
4. ✅ Updated error code usage to match test expectations
5. ✅ Fixed resolver bot to use correct `resolve_market` signature (`final_market_cap: u64`)
6. ✅ Removed `bump` fields from documentation (not in actual account structures)
7. ✅ Updated documentation to reflect actual error codes and instruction signatures

**Current State:**

- All error codes match between tests and program
- Resolver bot uses correct instruction signature
- Documentation accurately reflects codebase
- Ready for integration and deployment

---

This is the complete system. The code and documentation are now aligned. The resolver is built. The tests are written. Now it needs to be deployed, tested adversarially, and wired to the UI.

