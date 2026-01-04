"use client"

import { Button } from "@/components/ui/button"
import { XLogo } from "@/components/x-logo"
import { ArrowLeft, BookOpen, Zap, Shield, Users, TrendingUp, Target, Clock, DollarSign, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react"
import Link from "next/link"

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419-.019 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1568 2.4189Z"/>
    </svg>
  )
}

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Home</span>
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="https://arena.trench-market.fun"
                className="text-sm font-medium text-neon-green hover:text-neon-green/80 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                Enter Arena →
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16">
          <div className="mb-6">
            <img
              src="/trench-market-logo1.png"
              alt="Trenchmarket Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto opacity-80"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-transparent">
            Documentation
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto">
            Everything you need to know about Trenchmarket - the fastest prediction market on Solana.
          </p>
        </div>

        {/* Quick Start */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Zap className="w-6 h-6 text-neon-green" />
            <h2 className="text-2xl sm:text-3xl font-bold">Quick Start</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-3 text-neon-green">1. Connect Wallet</h3>
              <p className="text-muted-foreground mb-4">
                Connect your Solana wallet (Phantom, Solflare, etc.) to start trading.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-neon-green/20">
                <p className="text-sm text-neon-green font-mono">
                  Supported: Phantom, Solflare, Backpack, Glow
                </p>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-3 text-neon-cyan">2. Choose a Market</h3>
              <p className="text-muted-foreground mb-4">
                Browse active prediction markets on trending memecoins.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-neon-cyan/20">
                <p className="text-sm text-neon-cyan font-mono">
                  Markets resolve based on real market data
                </p>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-3 text-neon-magenta">3. Place Your Bet</h3>
              <p className="text-muted-foreground mb-4">
                Bet YES or NO on whether the token will hit its target market cap.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-neon-magenta/20">
                <p className="text-sm text-neon-magenta font-mono">
                  Minimum bet: 0.01 SOL
                </p>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-3 text-yellow-400">4. Win & Claim</h3>
              <p className="text-muted-foreground mb-4">
                If your prediction is correct, claim your winnings when the market resolves.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-yellow-400/20">
                <p className="text-sm text-yellow-400 font-mono">
                  Markets auto-resolve at expiration
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Target className="w-6 h-6 text-neon-cyan" />
            <h2 className="text-2xl sm:text-3xl font-bold">How It Works</h2>
          </div>

          <div className="glass p-6 sm:p-8 rounded-xl">
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <h3 className="text-xl font-semibold mb-4">Prediction Markets</h3>
                <p className="text-muted-foreground mb-6">
                  Trenchmarket allows you to bet on whether memecoins will reach specific market cap targets.
                  Each market has a clear question, deadline, and resolution criteria.
                </p>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">YES Position</h4>
                      <p className="text-sm text-muted-foreground">
                        Bet that the token WILL reach the target market cap
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <h4 className="font-medium">NO Position</h4>
                      <p className="text-sm text-muted-foreground">
                        Bet that the token will NOT reach the target market cap
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Market Resolution</h3>
                <p className="text-muted-foreground mb-6">
                  Markets automatically resolve based on real market data from trusted sources like
                  CoinGecko, CoinMarketCap, and DexScreener.
                </p>

                <div className="bg-black/20 rounded-lg p-4 border border-neon-green/20">
                  <h4 className="font-medium mb-2 text-neon-green">Resolution Sources</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• CoinGecko API</li>
                    <li>• CoinMarketCap API</li>
                    <li>• DexScreener API</li>
                    <li>• Birdeye API</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trading Mechanics */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-neon-magenta" />
            <h2 className="text-2xl sm:text-3xl font-bold">Trading Mechanics</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Automated Market Maker (AMM)</h3>
              <p className="text-muted-foreground mb-4">
                Our AMM ensures fair pricing and constant liquidity for all positions.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Formula:</span>
                  <code className="text-neon-cyan">constant_product(x * y = k)</code>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Slippage:</span>
                  <span className="text-neon-green">Dynamic</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Liquidity:</span>
                  <span className="text-neon-magenta">Constant</span>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4">Position Management</h3>
              <p className="text-muted-foreground mb-4">
                Manage your positions with advanced trading features.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-neon-green rounded-full"></div>
                  <span className="text-sm">Buy YES/NO positions</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-neon-magenta rounded-full"></div>
                  <span className="text-sm">Sell existing positions</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                  <span className="text-sm">Claim winnings after resolution</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Fees & Costs */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <DollarSign className="w-6 h-6 text-yellow-400" />
            <h2 className="text-2xl sm:text-3xl font-bold">Fees & Costs</h2>
          </div>

          <div className="glass p-6 rounded-xl">
            <div className="grid gap-6 md:grid-cols-3">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Trading Fees</h3>
                <div className="text-3xl font-bold text-neon-green mb-1">0%</div>
                <p className="text-sm text-muted-foreground">
                  No trading fees on Trenchmarket
                </p>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Network Fees</h3>
                <div className="text-3xl font-bold text-neon-cyan mb-1">~0.000005</div>
                <p className="text-sm text-muted-foreground">
                  Solana network transaction fees
                </p>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Position Creation</h3>
                <div className="text-3xl font-bold text-neon-magenta mb-1">0.001</div>
                <p className="text-sm text-muted-foreground">
                  SOL rent for new positions
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-400/10 border border-yellow-400/20 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-medium text-yellow-400 mb-1">Important Notes</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• 0.01 SOL minimum fee applies to pre-resolution position sales</li>
                    <li>• All fees are paid to Solana network, not Trenchmarket</li>
                    <li>• No platform fees - we believe in true decentralization</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Risk & Security */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Shield className="w-6 h-6 text-red-400" />
            <h2 className="text-2xl sm:text-3xl font-bold">Risk & Security</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-red-400">Risks</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Market Volatility</h4>
                    <p className="text-sm text-muted-foreground">
                      Memecoin markets are highly volatile. You can lose your entire investment.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Smart Contract Risk</h4>
                    <p className="text-sm text-muted-foreground">
                      All smart contracts carry risk. Our code is audited but not risk-free.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-4 h-4 text-red-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Liquidity Risk</h4>
                    <p className="text-sm text-muted-foreground">
                      Low liquidity can result in poor price execution and slippage.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-green-400">Security Measures</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Audited Contracts</h4>
                    <p className="text-sm text-muted-foreground">
                      Smart contracts undergo regular security audits.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Non-Custodial</h4>
                    <p className="text-sm text-muted-foreground">
                      You control your funds at all times. We cannot access them.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="w-4 h-4 text-green-400 mt-1 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium">Open Source</h4>
                    <p className="text-sm text-muted-foreground">
                      All code is publicly auditable on GitHub.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className="w-6 h-6 text-neon-cyan" />
            <h2 className="text-2xl sm:text-3xl font-bold">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-2">What makes Trenchmarket different?</h3>
              <p className="text-muted-foreground">
                Trenchmarket is built specifically for memecoin prediction markets on Solana.
                We offer zero platform fees, instant settlements, and focus exclusively on the
                most volatile and exciting part of crypto markets.
              </p>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-2">How are markets resolved?</h3>
              <p className="text-muted-foreground">
                Markets are resolved using data from multiple trusted sources (CoinGecko,
                CoinMarketCap, DexScreener, Birdeye). If there's any discrepancy, the market
                creator makes the final determination based on the most reliable data available.
              </p>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-2">Can I lose money?</h3>
              <p className="text-muted-foreground">
                <strong>Yes, absolutely.</strong> Prediction markets are high-risk, high-reward.
                You can lose your entire investment if your prediction is wrong. Only trade
                with money you can afford to lose completely.
              </p>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-2">What's the minimum bet?</h3>
              <p className="text-muted-foreground">
                The minimum bet is 0.01 SOL. This covers Solana network fees and ensures
                meaningful position sizes for market calculations.
              </p>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-2">Are there time limits on markets?</h3>
              <p className="text-muted-foreground">
                Each market has a clear expiration date. Markets can only be traded before
                this date. After expiration, the market resolves automatically based on
                the predefined criteria.
              </p>
            </div>
          </div>
        </section>

        {/* Community & Support */}
        <section className="mb-12 sm:mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Users className="w-6 h-6 text-neon-magenta" />
            <h2 className="text-2xl sm:text-3xl font-bold">Community & Support</h2>
          </div>

          <div className="glass p-6 sm:p-8 rounded-xl">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <h3 className="text-xl font-semibold mb-4">Get Help</h3>
                <div className="space-y-4">
                  <a
                    href="https://discord.gg/FnQ7y4pj"
                    className="flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-magenta/50 transition-all duration-300 group"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <DiscordIcon className="w-6 h-6 text-neon-magenta group-hover:text-neon-magenta/80 transition-colors" />
                    <div>
                      <h4 className="font-medium">Discord Community</h4>
                      <p className="text-sm text-muted-foreground">Join our community for support and discussions</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-neon-magenta transition-colors ml-auto" />
                  </a>

                  <a
                    href="https://x.com/Trenchmarket_"
                    className="flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-cyan/50 transition-all duration-300 group"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <XLogo className="w-6 h-6 text-neon-cyan group-hover:text-neon-cyan/80 transition-colors" />
                    <div>
                      <h4 className="font-medium">Follow on X</h4>
                      <p className="text-sm text-muted-foreground">Stay updated with latest news and features</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-neon-cyan transition-colors ml-auto" />
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-xl font-semibold mb-4">Resources</h3>
                <div className="space-y-4">
                  <a
                    href="https://github.com/wave745/memebet-arena"
                    className="flex items-center gap-3 p-4 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-green/50 transition-all duration-300 group"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <svg className="w-6 h-6 text-neon-green group-hover:text-neon-green/80 transition-colors" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                    </svg>
                    <div>
                      <h4 className="font-medium">GitHub Repository</h4>
                      <p className="text-sm text-muted-foreground">View source code and contribute</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-neon-green transition-colors ml-auto" />
                  </a>

                  <div className="p-4 rounded-lg bg-gradient-to-r from-neon-green/10 to-neon-cyan/10 border border-neon-green/20">
                    <h4 className="font-medium text-neon-green mb-2">Need Help?</h4>
                    <p className="text-sm text-muted-foreground">
                      Check our Discord for quick support, or create an issue on GitHub for technical problems.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center pt-8 border-t border-border/50">
          <p className="text-muted-foreground mb-4">
            Built with ❤️ for the Solana ecosystem
          </p>
          <div className="flex justify-center gap-6">
            <a
              href="https://arena.trench-market.fun"
              className="text-neon-green hover:text-neon-green/80 transition-colors font-medium"
            >
              Enter Arena
            </a>
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              Back to Home
            </Link>
          </div>
        </footer>
      </div>
    </div>
  )
}