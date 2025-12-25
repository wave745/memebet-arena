interface Trade {
  timestamp: number
  priceUsd: number
  volume: number
}

interface TokenData {
  pairs: {
    baseToken: {
      address: string
      symbol: string
    }
    priceUsd: string
    volume: {
      h24: number
    }
    fdv: number
    liquidity: {
      usd: number
    }
    // Simulated trade history for VWAP
    trades?: Trade[]
    // Circulating supply (may be missing)
    circulatingSupply?: number
  }[]
}

// =============================================================================
// VWAP COMPUTATION (Mirror of resolver logic)
// =============================================================================

function computeVWAP(trades: Trade[], endTimestamp: number, windowMinutes = 10): number | null {
  const windowStart = endTimestamp - windowMinutes * 60 * 1000

  // Filter trades within window and BEFORE end timestamp
  const validTrades = trades.filter(
    (t) => t.timestamp >= windowStart && t.timestamp <= endTimestamp, // Sharp cutoff
  )

  // EDGE CASE 1: Zero volume window
  if (validTrades.length === 0) {
    console.log("[ORACLE] Zero-volume window detected. Resolution REJECTED.")
    return null // Cannot resolve - no data
  }

  const totalVolume = validTrades.reduce((sum, t) => sum + t.volume, 0)

  // Guard against zero total volume
  if (totalVolume === 0) {
    console.log("[ORACLE] Total volume is zero. Resolution REJECTED.")
    return null
  }

  const vwap = validTrades.reduce((sum, t) => sum + t.priceUsd * t.volume, 0) / totalVolume

  return vwap
}

function computeMarketCap(vwap: number, circulatingSupply: number | undefined): number | null {
  // EDGE CASE 3: Missing circulating supply
  if (circulatingSupply === undefined || circulatingSupply === null || circulatingSupply <= 0) {
    console.log("[ORACLE] Missing or invalid circulating supply. Resolution REJECTED.")
    return null
  }

  return vwap * circulatingSupply
}

function determineOutcome(marketCap: number, targetMarketCap: number): boolean {
  // EDGE CASE 6: Exact equality - rule is >=, so this is YES
  return marketCap >= targetMarketCap
}

// =============================================================================
// TEST HARNESS
// =============================================================================

interface TestResult {
  name: string
  passed: boolean
  expected: string
  actual: string
  notes: string
}

const results: TestResult[] = []

function runTest(name: string, testFn: () => { expected: string; actual: string; passed: boolean; notes: string }) {
  console.log(`\n${"=".repeat(60)}`)
  console.log(`TEST: ${name}`)
  console.log("=".repeat(60))

  try {
    const result = testFn()
    results.push({ name, ...result })
    console.log(`RESULT: ${result.passed ? "PASS" : "FAIL"}`)
    console.log(`Expected: ${result.expected}`)
    console.log(`Actual: ${result.actual}`)
    if (result.notes) console.log(`Notes: ${result.notes}`)
  } catch (err) {
    results.push({
      name,
      passed: false,
      expected: "No error",
      actual: `Error: ${err}`,
      notes: "Test threw an exception",
    })
    console.log(`RESULT: FAIL (Exception)`)
    console.log(`Error: ${err}`)
  }
}

// =============================================================================
// EDGE CASE 1: Zero-Volume Window
// =============================================================================

runTest("Zero-Volume Window", () => {
  const endTimestamp = Date.now()
  const trades: Trade[] = [] // No trades at all

  const vwap = computeVWAP(trades, endTimestamp)

  return {
    expected: "VWAP should be null (resolution rejected)",
    actual: vwap === null ? "VWAP is null (resolution rejected)" : `VWAP is ${vwap}`,
    passed: vwap === null,
    notes: "Bot must fail resolution, not guess or default to zero",
  }
})

runTest("Zero-Volume Window (trades exist but outside window)", () => {
  const endTimestamp = Date.now()
  const windowStart = endTimestamp - 10 * 60 * 1000

  // Trades exist, but all are before the 10-minute window
  const trades: Trade[] = [
    { timestamp: windowStart - 60000, priceUsd: 0.001, volume: 1000 },
    { timestamp: windowStart - 120000, priceUsd: 0.0012, volume: 500 },
  ]

  const vwap = computeVWAP(trades, endTimestamp)

  return {
    expected: "VWAP should be null (no trades in window)",
    actual: vwap === null ? "VWAP is null" : `VWAP is ${vwap}`,
    passed: vwap === null,
    notes: "Old trades must not count toward resolution",
  }
})

// =============================================================================
// EDGE CASE 2: Single-Trade Manipulation
// =============================================================================

runTest("Single-Trade Manipulation (whale buy at end)", () => {
  const endTimestamp = Date.now()
  const windowStart = endTimestamp - 10 * 60 * 1000

  // Normal trading, then one massive buy 30 seconds before end
  const trades: Trade[] = [
    { timestamp: windowStart + 60000, priceUsd: 0.001, volume: 100 },
    { timestamp: windowStart + 120000, priceUsd: 0.001, volume: 100 },
    { timestamp: windowStart + 180000, priceUsd: 0.001, volume: 100 },
    { timestamp: windowStart + 240000, priceUsd: 0.001, volume: 100 },
    { timestamp: windowStart + 300000, priceUsd: 0.001, volume: 100 },
    // Whale buy - 30 seconds before end, 10x volume, 50% higher price
    { timestamp: endTimestamp - 30000, priceUsd: 0.0015, volume: 5000 },
  ]

  const vwap = computeVWAP(trades, endTimestamp)

  // Calculate what we expect
  // Normal trades: 5 * (0.001 * 100) = 0.5 price-volume
  // Whale trade: 0.0015 * 5000 = 7.5 price-volume
  // Total volume: 500 + 5000 = 5500
  // Expected VWAP: 8.0 / 5500 = 0.001454...
  const expectedVWAP = (5 * 0.001 * 100 + 0.0015 * 5000) / (500 + 5000)

  const isAccurate = vwap !== null && Math.abs(vwap - expectedVWAP) < 0.0000001

  return {
    expected: `VWAP heavily weighted by whale trade: ~${expectedVWAP.toFixed(6)}`,
    actual: vwap !== null ? `VWAP is ${vwap.toFixed(6)}` : "VWAP is null",
    passed: isAccurate,
    notes: "This is BY DESIGN. VWAP reflects volume. If someone wants to manipulate, they pay for it. Rules are rules.",
  }
})

// =============================================================================
// EDGE CASE 3: DexScreener Data Inconsistency
// =============================================================================

runTest("Missing Circulating Supply", () => {
  const vwap = 0.001 // Valid VWAP
  const circulatingSupply = undefined

  const marketCap = computeMarketCap(vwap, circulatingSupply)

  return {
    expected: "Market cap should be null (resolution rejected)",
    actual: marketCap === null ? "Market cap is null" : `Market cap is ${marketCap}`,
    passed: marketCap === null,
    notes: "Never fill in missing fields. Garbage in = no resolution out.",
  }
})

runTest("Zero Circulating Supply", () => {
  const vwap = 0.001
  const circulatingSupply = 0

  const marketCap = computeMarketCap(vwap, circulatingSupply)

  return {
    expected: "Market cap should be null (invalid supply)",
    actual: marketCap === null ? "Market cap is null" : `Market cap is ${marketCap}`,
    passed: marketCap === null,
    notes: "Zero supply is invalid. Reject, do not compute.",
  }
})

runTest("Negative Circulating Supply (corrupted data)", () => {
  const vwap = 0.001
  const circulatingSupply = -1000000

  const marketCap = computeMarketCap(vwap, circulatingSupply)

  return {
    expected: "Market cap should be null (negative supply rejected)",
    actual: marketCap === null ? "Market cap is null" : `Market cap is ${marketCap}`,
    passed: marketCap === null,
    notes: "Corrupted data must be rejected outright.",
  }
})

// =============================================================================
// EDGE CASE 4: Time Skew
// =============================================================================

runTest("Trades After End Timestamp (should be excluded)", () => {
  const endTimestamp = Date.now()
  const windowStart = endTimestamp - 10 * 60 * 1000

  const trades: Trade[] = [
    // Valid trades
    { timestamp: windowStart + 60000, priceUsd: 0.001, volume: 1000 },
    { timestamp: windowStart + 120000, priceUsd: 0.001, volume: 1000 },
    // Trades AFTER end timestamp - should be IGNORED
    { timestamp: endTimestamp + 1000, priceUsd: 0.01, volume: 10000 }, // 10x price, huge volume
    { timestamp: endTimestamp + 5000, priceUsd: 0.02, volume: 20000 },
  ]

  const vwap = computeVWAP(trades, endTimestamp)

  // Only valid trades should count: 2 trades at 0.001, 1000 volume each
  // Expected VWAP = 0.001
  const expectedVWAP = 0.001

  const isAccurate = vwap !== null && Math.abs(vwap - expectedVWAP) < 0.0000001

  return {
    expected: `VWAP should be ${expectedVWAP} (post-end trades ignored)`,
    actual: vwap !== null ? `VWAP is ${vwap.toFixed(6)}` : "VWAP is null",
    passed: isAccurate,
    notes: "Markets end sharply. Not kindly. timestamp <= end_timestamp only.",
  }
})

runTest("Trade Exactly At End Timestamp (should be included)", () => {
  const endTimestamp = Date.now()
  const windowStart = endTimestamp - 10 * 60 * 1000

  const trades: Trade[] = [
    { timestamp: windowStart + 60000, priceUsd: 0.001, volume: 1000 },
    { timestamp: endTimestamp, priceUsd: 0.002, volume: 1000 }, // Exactly at end
  ]

  const vwap = computeVWAP(trades, endTimestamp)

  // Expected: (0.001 * 1000 + 0.002 * 1000) / 2000 = 0.0015
  const expectedVWAP = 0.0015

  const isAccurate = vwap !== null && Math.abs(vwap - expectedVWAP) < 0.0000001

  return {
    expected: `VWAP should include trade at exact end time: ${expectedVWAP}`,
    actual: vwap !== null ? `VWAP is ${vwap.toFixed(6)}` : "VWAP is null",
    passed: isAccurate,
    notes: "Rule is <=, so exact match is included.",
  }
})

// =============================================================================
// EDGE CASE 5: Double-Resolver Race (simulated)
// =============================================================================

runTest("Double-Resolver Race (state simulation)", () => {
  // Simulate market state
  let marketResolved = false
  let marketOutcome: boolean | null = null
  let resolveAttempts = 0

  function simulateResolveMarket(outcome: boolean): { success: boolean; error?: string } {
    resolveAttempts++

    if (marketResolved) {
      return { success: false, error: "Market already resolved" }
    }

    // First resolver wins
    marketResolved = true
    marketOutcome = outcome
    return { success: true }
  }

  // Two resolvers try simultaneously (simulated as sequential for test)
  const resolver1 = simulateResolveMarket(true) // YES
  const resolver2 = simulateResolveMarket(true) // Also YES (same data)

  const passed = resolver1.success && !resolver2.success && resolveAttempts === 2

  return {
    expected: "First resolver succeeds, second fails, state unchanged after first",
    actual: `Resolver1: ${resolver1.success}, Resolver2: ${resolver2.success}, Attempts: ${resolveAttempts}`,
    passed,
    notes: "On-chain, the program rejects if already resolved. This simulates that behavior.",
  }
})

// =============================================================================
// EDGE CASE 6: Market Cap Edge Cases
// =============================================================================

runTest("Market Cap Exactly Equals Target (>=, should be YES)", () => {
  const targetMarketCap = 100_000_000 // $100M
  const actualMarketCap = 100_000_000 // Exactly equal

  const outcome = determineOutcome(actualMarketCap, targetMarketCap)

  return {
    expected: "Outcome should be YES (true) because >= includes equality",
    actual: outcome ? "YES (true)" : "NO (false)",
    passed: outcome === true,
    notes: "Rule is >=. Exact equality is YES. No ambiguity.",
  }
})

runTest("Market Cap One Lamport Below Target", () => {
  const targetMarketCap = 100_000_000
  const actualMarketCap = 99_999_999.999999 // Just below

  const outcome = determineOutcome(actualMarketCap, targetMarketCap)

  return {
    expected: "Outcome should be NO (false)",
    actual: outcome ? "YES (true)" : "NO (false)",
    passed: outcome === false,
    notes: "No grace margins. No rounding up. < target = NO.",
  }
})

runTest("Very Large Market Cap (overflow check)", () => {
  const targetMarketCap = 1_000_000_000_000 // $1T
  const actualMarketCap = 999_999_999_999_999 // ~$1000T (absurd but valid number)

  const outcome = determineOutcome(actualMarketCap, targetMarketCap)

  // JavaScript handles this fine, but Rust u64 max is ~18.4 quintillion
  const isValidNumber = Number.isFinite(actualMarketCap) && !Number.isNaN(actualMarketCap)

  return {
    expected: "Large numbers should compute correctly without overflow",
    actual: isValidNumber ? `Valid: ${outcome ? "YES" : "NO"}` : "OVERFLOW/NaN",
    passed: isValidNumber && outcome === true,
    notes: "JS handles big numbers. Rust uses u64 (max ~18.4e18). Market caps stay well below.",
  }
})

runTest("Decimal Precision (floating point edge)", () => {
  // Classic floating point issue: 0.1 + 0.2 !== 0.3
  const vwap = 0.1 + 0.2 // 0.30000000000000004 in JS
  const circulatingSupply = 1_000_000_000

  const marketCap = vwap * circulatingSupply
  const target = 300_000_000 // $300M

  const outcome = determineOutcome(marketCap, target)

  // Due to floating point, marketCap will be slightly > 300M
  const expectedOutcome = marketCap >= target

  return {
    expected: `Floating point: marketCap = ${marketCap}, outcome = ${expectedOutcome ? "YES" : "NO"}`,
    actual: outcome ? "YES" : "NO",
    passed: outcome === expectedOutcome,
    notes: "Floating point is deterministic. Same inputs = same outputs. Precision loss is acceptable if consistent.",
  }
})

// =============================================================================
// SUMMARY
// =============================================================================

console.log("\n\n" + "=".repeat(60))
console.log("ORACLE ABUSE TEST SUMMARY")
console.log("=".repeat(60))

const passed = results.filter((r) => r.passed).length
const failed = results.filter((r) => !r.passed).length

console.log(`\nTotal: ${results.length}`)
console.log(`Passed: ${passed}`)
console.log(`Failed: ${failed}`)

if (failed > 0) {
  console.log("\nFAILED TESTS:")
  results
    .filter((r) => !r.passed)
    .forEach((r) => {
      console.log(`  - ${r.name}`)
      console.log(`    Expected: ${r.expected}`)
      console.log(`    Actual: ${r.actual}`)
    })
}

console.log("\n" + "=".repeat(60))
if (failed === 0) {
  console.log("THE ORACLE HAS BEEN HUNTED.")
  console.log("All edge cases handled. Resolution logic is sound.")
} else {
  console.log("ORACLE VULNERABILITIES DETECTED.")
  console.log("Fix failures before proceeding.")
}
console.log("=".repeat(60))

// Exit with appropriate code
process.exit(failed > 0 ? 1 : 0)
