"use client"

import { Button } from "@/components/ui/button"
import { XLogo } from "@/components/x-logo"
import { ArrowLeft, BookOpen, Zap, Shield, Users, TrendingUp, Target, Clock, DollarSign, AlertTriangle, CheckCircle, ExternalLink } from "lucide-react"
import Link from "next/link"
import { useEffect, useRef, useState } from "react"

// Custom animations
const customStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px); }
    50% { transform: translateY(-10px); }
  }

  @keyframes gradient-x {
    0%, 100% { background-size: 200% 200%; background-position: left center; }
    50% { background-size: 200% 200%; background-position: right center; }
  }

  .animate-float {
    animation: float 3s ease-in-out infinite;
  }

  .animate-gradient-x {
    animation: gradient-x 3s ease infinite;
  }
`

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
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set())
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map())

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const sectionId = entry.target.getAttribute('data-section')
            if (sectionId) {
              setVisibleSections(prev => new Set(prev).add(sectionId))
            }
          }
        })
      },
      { threshold: 0.1, rootMargin: '-50px' }
    )

    // Observe all sections
    const sections = document.querySelectorAll('[data-section]')
    sections.forEach(section => observer.observe(section))

    return () => observer.disconnect()
  }, [])

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: customStyles }} />
      <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border/50 bg-background/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <a
                href="https://www.trench-market.fun"
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span className="text-sm font-medium">Back to Home</span>
              </a>
            </div>
            <div className="flex items-center gap-4">
              <a
                href="/app"
                className="text-sm font-medium text-neon-green hover:text-neon-green/80 transition-colors"
              >
                Enter Arena →
              </a>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Hero Section */}
        <div className="text-center mb-12 sm:mb-16 relative">
          {/* Background animated elements */}
          <div className="absolute inset-0 -z-10 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-neon-green rounded-full animate-ping opacity-20"></div>
            <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-neon-cyan rounded-full animate-ping opacity-30" style={{ animationDelay: '1s' }}></div>
            <div className="absolute top-1/2 left-1/2 w-1.5 h-1.5 bg-neon-magenta rounded-full animate-ping opacity-25" style={{ animationDelay: '2s' }}></div>
          </div>

          <div className="mb-6 animate-float">
            <img
              src="/trench-market-logo1.png"
              alt="Trenchmarket Logo"
              className="w-16 h-16 sm:w-20 sm:h-20 mx-auto opacity-80 hover:opacity-100 transition-opacity duration-300 hover:scale-110 transform-gpu"
            />
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black mb-4 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-transparent animate-gradient-x hover:scale-105 transition-transform duration-500">
            Documentation
          </h1>
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto hover:text-foreground/80 transition-colors duration-300">
            Everything you need to know about Trenchmarket - the fastest prediction market on Solana.
          </p>

          {/* Animated accent line */}
          <div className="mt-6 mx-auto w-24 h-0.5 bg-gradient-to-r from-transparent via-neon-cyan to-transparent animate-pulse"></div>
        </div>

        {/* Quick Start */}
        <section
          data-section="quick-start"
          ref={el => el && sectionRefs.current.set('quick-start', el)}
          className={`mb-12 sm:mb-16 transition-all duration-1000 ${
            visibleSections.has('quick-start')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <Zap className={`w-6 h-6 text-neon-green transition-all duration-500 ${
              visibleSections.has('quick-start') ? 'scale-100 rotate-0' : 'scale-75 rotate-12'
            }`} />
            <h2 className={`text-2xl sm:text-3xl font-bold transition-all duration-700 delay-200 ${
              visibleSections.has('quick-start') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}>Quick Start</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className={`glass p-6 rounded-xl transition-all duration-700 delay-300 hover:scale-[1.02] hover:shadow-lg hover:shadow-neon-green/20 group ${
              visibleSections.has('quick-start') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              <h3 className="text-lg font-semibold mb-3 text-neon-green group-hover:text-neon-green/90 transition-colors">1. Connect Wallet</h3>
              <p className="text-muted-foreground mb-4 group-hover:text-foreground/80 transition-colors">
                Connect your Solana wallet (Phantom, Solflare, etc.) to start trading.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-neon-green/20 group-hover:border-neon-green/40 transition-all duration-300 group-hover:bg-black/30">
                <p className="text-sm text-neon-green font-mono group-hover:text-neon-green/90 transition-colors">
                  Supported: Phantom, Solflare, Backpack, Glow
                </p>
              </div>
            </div>

            <div className={`glass p-6 rounded-xl transition-all duration-700 delay-400 hover:scale-[1.02] hover:shadow-lg hover:shadow-neon-cyan/20 group ${
              visibleSections.has('quick-start') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              <h3 className="text-lg font-semibold mb-3 text-neon-cyan group-hover:text-neon-cyan/90 transition-colors">2. Choose a Market</h3>
              <p className="text-muted-foreground mb-4 group-hover:text-foreground/80 transition-colors">
                Browse active prediction markets on trending memecoins.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-neon-cyan/20 group-hover:border-neon-cyan/40 transition-all duration-300 group-hover:bg-black/30">
                <p className="text-sm text-neon-cyan font-mono group-hover:text-neon-cyan/90 transition-colors">
                  Markets resolve based on real market data
                </p>
              </div>
            </div>

            <div className={`glass p-6 rounded-xl transition-all duration-700 delay-500 hover:scale-[1.02] hover:shadow-lg hover:shadow-neon-magenta/20 group ${
              visibleSections.has('quick-start') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              <h3 className="text-lg font-semibold mb-3 text-neon-magenta group-hover:text-neon-magenta/90 transition-colors">3. Place Your Bet</h3>
              <p className="text-muted-foreground mb-4 group-hover:text-foreground/80 transition-colors">
                Bet YES or NO on whether the token will hit its target market cap.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-neon-magenta/20 group-hover:border-neon-magenta/40 transition-all duration-300 group-hover:bg-black/30">
                <p className="text-sm text-neon-magenta font-mono group-hover:text-neon-magenta/90 transition-colors">
                  Minimum bet: 0.01 SOL
                </p>
              </div>
            </div>

            <div className={`glass p-6 rounded-xl transition-all duration-700 delay-600 hover:scale-[1.02] hover:shadow-lg hover:shadow-yellow-400/20 group ${
              visibleSections.has('quick-start') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`}>
              <h3 className="text-lg font-semibold mb-3 text-yellow-400 group-hover:text-yellow-400/90 transition-colors">4. Win & Claim</h3>
              <p className="text-muted-foreground mb-4 group-hover:text-foreground/80 transition-colors">
                If your prediction is correct, claim your winnings when the market resolves.
              </p>
              <div className="bg-black/20 rounded-lg p-3 border border-yellow-400/20 group-hover:border-yellow-400/40 transition-all duration-300 group-hover:bg-black/30">
                <p className="text-sm text-yellow-400 font-mono group-hover:text-yellow-400/90 transition-colors">
                  Markets auto-resolve at expiration
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          data-section="how-it-works"
          className={`mb-12 sm:mb-16 transition-all duration-1000 ${
            visibleSections.has('how-it-works')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <Target className={`w-6 h-6 text-neon-cyan transition-all duration-500 ${
              visibleSections.has('how-it-works') ? 'scale-100 rotate-0' : 'scale-75 rotate-12'
            }`} />
            <h2 className={`text-2xl sm:text-3xl font-bold transition-all duration-700 delay-200 ${
              visibleSections.has('how-it-works') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}>How It Works</h2>
          </div>

          <div className="glass p-6 sm:p-8 rounded-xl hover:shadow-2xl hover:shadow-neon-cyan/10 transition-all duration-500 group">
            <div className="grid gap-6 lg:grid-cols-2">
              <div className={`transition-all duration-700 delay-300 ${
                visibleSections.has('how-it-works') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-6'
              }`}>
                <h3 className="text-xl font-semibold mb-4 group-hover:text-neon-green transition-colors">Prediction Markets</h3>
                <p className="text-muted-foreground mb-6 group-hover:text-foreground/90 transition-colors">
                  Trenchmarket allows you to bet on whether memecoins will reach specific market cap targets.
                  Each market has a clear question, deadline, and resolution criteria.
                </p>

                <div className="space-y-4">
                  <div className={`flex items-start gap-3 p-3 rounded-lg hover:bg-neon-green/5 transition-all duration-300 group/item ${
                    visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`} style={{ transitionDelay: '0.6s' }}>
                    <CheckCircle className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                    <div>
                      <h4 className="font-medium group-hover/item:text-neon-green transition-colors">YES Position</h4>
                      <p className="text-sm text-muted-foreground group-hover/item:text-foreground/80 transition-colors">
                        Bet that the token WILL reach the target market cap
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start gap-3 p-3 rounded-lg hover:bg-neon-magenta/5 transition-all duration-300 group/item ${
                    visibleSections.has('how-it-works') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
                  }`} style={{ transitionDelay: '0.8s' }}>
                    <CheckCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0 group-hover/item:scale-110 transition-transform" />
                    <div>
                      <h4 className="font-medium group-hover/item:text-neon-magenta transition-colors">NO Position</h4>
                      <p className="text-sm text-muted-foreground group-hover/item:text-foreground/80 transition-colors">
                        Bet that the token will NOT reach the target market cap
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className={`transition-all duration-700 delay-500 ${
                visibleSections.has('how-it-works') ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-6'
              }`}>
                <h3 className="text-xl font-semibold mb-4 group-hover:text-neon-cyan transition-colors">Market Resolution</h3>
                <p className="text-muted-foreground mb-6 group-hover:text-foreground/90 transition-colors">
                  Markets are resolved using data from multiple trusted sources like
                  CoinGecko, CoinMarketCap, and DexScreener.
                </p>

                <div className="bg-black/20 rounded-lg p-4 border border-neon-green/20 hover:border-neon-green/40 hover:bg-black/30 transition-all duration-300 group-hover:shadow-lg group-hover:shadow-neon-green/10">
                  <h4 className="font-medium mb-2 text-neon-green group-hover:text-neon-green/90 transition-colors">Resolution Sources</h4>
                  <ul className="text-sm text-muted-foreground space-y-1 group-hover:text-foreground/80 transition-colors">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse"></div>
                      CoinGecko API
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-neon-cyan rounded-full animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                      CoinMarketCap API
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-neon-magenta rounded-full animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                      DexScreener API
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-yellow-400 rounded-full animate-pulse" style={{ animationDelay: '0.6s' }}></div>
                      Birdeye API
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trading Mechanics */}
        <section
          data-section="trading-mechanics"
          className={`mb-12 sm:mb-16 transition-all duration-1000 ${
            visibleSections.has('trading-mechanics')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className={`w-6 h-6 text-neon-magenta transition-all duration-500 ${
              visibleSections.has('trading-mechanics') ? 'scale-100 rotate-0' : 'scale-75 -rotate-12'
            }`} />
            <h2 className={`text-2xl sm:text-3xl font-bold transition-all duration-700 delay-200 ${
              visibleSections.has('trading-mechanics') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}>Trading Mechanics</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className={`glass p-6 rounded-xl hover:scale-[1.02] hover:shadow-xl hover:shadow-neon-cyan/20 transition-all duration-500 group ${
              visibleSections.has('trading-mechanics') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`} style={{ transitionDelay: '0.3s' }}>
              <h3 className="text-lg font-semibold mb-4 group-hover:text-neon-cyan transition-colors">Automated Market Maker (AMM)</h3>
              <p className="text-muted-foreground mb-4 group-hover:text-foreground/90 transition-colors">
                Our AMM ensures fair pricing and constant liquidity for all positions.
              </p>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between p-2 rounded hover:bg-white/5 transition-colors">
                  <span className="text-muted-foreground">Formula:</span>
                  <code className="text-neon-cyan group-hover:text-neon-cyan/90 transition-colors font-bold">constant_product(x * y = k)</code>
                </div>
                <div className="flex justify-between p-2 rounded hover:bg-white/5 transition-colors">
                  <span className="text-muted-foreground">Slippage:</span>
                  <span className="text-neon-green group-hover:text-neon-green/90 transition-colors font-semibold">Dynamic</span>
                </div>
                <div className="flex justify-between p-2 rounded hover:bg-white/5 transition-colors">
                  <span className="text-muted-foreground">Liquidity:</span>
                  <span className="text-neon-magenta group-hover:text-neon-magenta/90 transition-colors font-semibold">Constant</span>
                </div>
              </div>
            </div>

            <div className={`glass p-6 rounded-xl hover:scale-[1.02] hover:shadow-xl hover:shadow-neon-magenta/20 transition-all duration-500 group ${
              visibleSections.has('trading-mechanics') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'
            }`} style={{ transitionDelay: '0.5s' }}>
              <h3 className="text-lg font-semibold mb-4 group-hover:text-neon-magenta transition-colors">Position Management</h3>
              <p className="text-muted-foreground mb-4 group-hover:text-foreground/90 transition-colors">
                Manage your positions with advanced trading features.
              </p>
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-2 rounded hover:bg-neon-green/5 transition-all duration-300 group/item">
                  <div className="w-2 h-2 bg-neon-green rounded-full group-hover/item:scale-125 transition-transform animate-pulse"></div>
                  <span className="text-sm group-hover/item:text-neon-green transition-colors">Buy YES/NO positions</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-neon-magenta/5 transition-all duration-300 group/item">
                  <div className="w-2 h-2 bg-neon-magenta rounded-full group-hover/item:scale-125 transition-transform animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                  <span className="text-sm group-hover/item:text-neon-magenta transition-colors">Sell existing positions</span>
                </div>
                <div className="flex items-center gap-3 p-2 rounded hover:bg-yellow-400/5 transition-all duration-300 group/item">
                  <div className="w-2 h-2 bg-yellow-400 rounded-full group-hover/item:scale-125 transition-transform animate-pulse" style={{ animationDelay: '0.4s' }}></div>
                  <span className="text-sm group-hover/item:text-yellow-400 transition-colors">Claim winnings after resolution</span>
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
                    <h4 className="font-medium">Program ID</h4>
                    <p className="text-sm text-muted-foreground mb-2">
                      Official Trenchmarket smart contract address:
                    </p>
                    <code className="text-xs bg-black/40 px-2 py-1 rounded font-mono text-neon-green break-all">
                      G3ctDAx46fPX4cTZgzcgzW1rDCe7e8qCqhCUTSf3a7LP
                    </code>
                  </div>
                </div>

              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section
          data-section="faq"
          className={`mb-12 sm:mb-16 transition-all duration-1000 ${
            visibleSections.has('faq')
              ? 'opacity-100 translate-y-0'
              : 'opacity-0 translate-y-8'
          }`}
        >
          <div className="flex items-center gap-3 mb-6">
            <BookOpen className={`w-6 h-6 text-neon-cyan transition-all duration-500 ${
              visibleSections.has('faq') ? 'scale-100 rotate-0' : 'scale-75 rotate-12'
            }`} />
            <h2 className={`text-2xl sm:text-3xl font-bold transition-all duration-700 delay-200 ${
              visibleSections.has('faq') ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4'
            }`}>Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            <div className={`glass p-6 rounded-xl hover:scale-[1.01] hover:shadow-lg hover:shadow-neon-green/10 transition-all duration-300 group cursor-pointer ${
              visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`} style={{ transitionDelay: '0.3s' }}>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-neon-green transition-colors">What makes Trenchmarket different?</h3>
              <p className="text-muted-foreground group-hover:text-foreground/90 transition-colors">
                Trenchmarket is built specifically for memecoin prediction markets on Solana.
                We offer zero platform fees, instant settlements, and focus exclusively on the
                most volatile and exciting part of crypto markets.
              </p>
            </div>

            <div className={`glass p-6 rounded-xl hover:scale-[1.01] hover:shadow-lg hover:shadow-neon-cyan/10 transition-all duration-300 group cursor-pointer ${
              visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`} style={{ transitionDelay: '0.5s' }}>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-neon-cyan transition-colors">How are markets resolved?</h3>
              <p className="text-muted-foreground group-hover:text-foreground/90 transition-colors">
                Markets are resolved using data from multiple trusted sources (CoinGecko,
                CoinMarketCap, DexScreener, Birdeye). If there's any discrepancy, the market
                creator makes the final determination based on the most reliable data available.
              </p>
            </div>

            <div className={`glass p-6 rounded-xl hover:scale-[1.01] hover:shadow-lg hover:shadow-neon-magenta/10 transition-all duration-300 group cursor-pointer ${
              visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`} style={{ transitionDelay: '0.7s' }}>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-neon-magenta transition-colors">What's the minimum bet?</h3>
              <p className="text-muted-foreground group-hover:text-foreground/90 transition-colors">
                The minimum bet is 0.01 SOL. This covers Solana network fees and ensures
                meaningful position sizes for market calculations.
              </p>
            </div>

            <div className={`glass p-6 rounded-xl hover:scale-[1.01] hover:shadow-lg hover:shadow-yellow-400/10 transition-all duration-300 group cursor-pointer ${
              visibleSections.has('faq') ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`} style={{ transitionDelay: '0.9s' }}>
              <h3 className="text-lg font-semibold mb-2 group-hover:text-yellow-400 transition-colors">Are there time limits on markets?</h3>
              <p className="text-muted-foreground group-hover:text-foreground/90 transition-colors">
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

                  <div className="p-4 rounded-lg bg-gradient-to-r from-neon-green/10 to-neon-cyan/10 border border-neon-green/20">
                    <h4 className="font-medium text-neon-green mb-2">Need Help?</h4>
                    <p className="text-sm text-muted-foreground">
                      Join our Discord community for support and discussions.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
    </>
  )
}