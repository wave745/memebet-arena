"use client"

import { Button } from "@/components/ui/button"
import { XLogo } from "@/components/x-logo"

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

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 text-center">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto">
        {/* Logo */}
        <div className="mb-8">
          <img
            src="/trench-market-logo1.png"
            alt="Trenchmarket Logo"
            className="w-32 h-32 mx-auto mb-4"
          />
        </div>

        {/* Title */}
        <div className="relative mb-6">
          {/* Background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-neon-green/30 via-neon-cyan/30 to-neon-magenta/30 blur-2xl opacity-50 animate-pulse"></div>

          <h1 className="relative text-6xl sm:text-8xl font-black mb-2 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-transparent tracking-wider drop-shadow-2xl">
            TRENCHMARKET
          </h1>

          {/* Animated underline */}
          <div className="relative mx-auto w-32 sm:w-48 h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta rounded-full opacity-80">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-pulse rounded-full"></div>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-xl sm:text-2xl text-muted-foreground mb-12 max-w-2xl mx-auto leading-relaxed">
          Belief markets on Solana memecoins.<br />
          <span className="text-neon-green font-semibold">Fast, degenerate, based.</span>
        </p>

        {/* CTA Button */}
        <div className="mb-16 relative">
          {/* Background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-neon-green/20 via-neon-cyan/20 to-neon-magenta/20 blur-3xl opacity-30 animate-pulse"></div>

          <Button
            size="lg"
            className="group relative bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 hover:border-neon-green/60 text-transparent bg-clip-text font-black text-sm px-6 py-3 h-auto rounded-2xl shadow-2xl shadow-black/50 hover:shadow-neon-green/30 transition-all duration-700 hover:scale-110 hover:-translate-y-2 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-neon-green/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000 after:absolute after:inset-0 after:bg-gradient-to-br after:from-neon-green/10 after:via-transparent after:to-neon-cyan/10 after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500"
            onClick={() => window.location.href = '/app'}
          >
            {/* Animated background particles */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-neon-green rounded-full animate-ping"></div>
              <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-neon-cyan rounded-full animate-ping [animation-delay:0.5s]"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-neon-magenta rounded-full animate-ping [animation-delay:1s]"></div>
            </div>

            <span className="relative z-10 bg-gradient-to-r from-white via-neon-green to-neon-cyan bg-clip-text text-transparent font-black text-sm tracking-wider">
              ENTER THE TRENCH
            </span>

            {/* Border glow animation */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta animate-spin opacity-20" style={{animationDuration: '3s'}}></div>
            </div>
          </Button>
        </div>

        {/* Social Links */}
        <div className="flex justify-center gap-6">
          <a
            href="https://x.com/Trenchmarket_"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-green/50 transition-all duration-300 group"
            target="_blank"
            rel="noopener noreferrer"
          >
            <XLogo className="w-5 h-5 text-neon-cyan group-hover:text-neon-green transition-colors" />
            <span className="text-sm font-medium">Follow on X</span>
          </a>

          <a
            href="https://discord.gg/FnQ7y4pj"
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-neon-magenta/50 transition-all duration-300 group"
            target="_blank"
            rel="noopener noreferrer"
          >
            <DiscordIcon className="w-5 h-5 text-neon-magenta group-hover:text-neon-magenta/80 transition-colors" />
            <span className="text-sm font-medium">Join Discord</span>
          </a>
        </div>
      </div>
    </div>
  )
}
