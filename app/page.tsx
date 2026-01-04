"use client"

import { Button } from "@/components/ui/button"
import { XLogo } from "@/components/x-logo"

function DocsIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14 2H6C4.89543 2 4 2.89543 4 4V20C4 21.1046 4.89543 22 6 22H18C19.1046 22 20 21.1046 20 20V8L14 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 2V8H20"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 13H8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 17H8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 9H8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

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
    <div className="min-h-screen flex flex-col items-center justify-center px-3 sm:px-4 py-2 sm:py-4 md:py-6 text-center">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto w-full px-2 sm:px-0">
        {/* Logo */}
        <div className="mb-2 sm:mb-4">
          <img
            src="/trench-market-logo1.png"
            alt="Trenchmarket Logo"
            className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 lg:w-32 lg:h-32 mx-auto"
          />
        </div>

        {/* Title */}
        <div className="relative mb-3 sm:mb-4 md:mb-6">
          {/* Background glow effect */}
          <div className="absolute inset-0 bg-gradient-to-r from-neon-green/20 sm:from-neon-green/30 via-neon-cyan/20 sm:via-neon-cyan/30 to-neon-magenta/20 sm:to-neon-magenta/30 blur-xl sm:blur-2xl opacity-40 sm:opacity-50 animate-pulse"></div>

          <h1 className="relative text-3xl xs:text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl font-black mb-2 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta bg-clip-text text-transparent tracking-wider drop-shadow-2xl leading-tight">
            TRENCHMARKET
          </h1>

          {/* Animated underline */}
          <div className="relative mx-auto w-20 sm:w-28 md:w-32 lg:w-40 xl:w-48 h-0.5 sm:h-1 bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta rounded-full opacity-80">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent animate-pulse rounded-full"></div>
          </div>
        </div>

        {/* Tagline */}
        <div className="mb-4 sm:mb-6 md:mb-8 lg:mb-10">
          <p className="text-base sm:text-lg md:text-xl lg:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-2">
            Belief markets on Solana memecoins.<br />
            <span className="text-neon-green font-semibold block sm:inline">Fast, degenerate, based.</span>
          </p>
        </div>

        {/* CTA Button */}
        <div className="mb-4 sm:mb-6 md:mb-8 relative">
          {/* Background glow effect - reduced for mobile */}
          <div className="absolute inset-0 bg-gradient-to-r from-neon-green/15 sm:from-neon-green/20 via-neon-cyan/15 sm:via-neon-cyan/20 to-neon-magenta/15 sm:to-neon-magenta/20 blur-2xl sm:blur-3xl opacity-25 sm:opacity-30 animate-pulse"></div>

          <Button
            size="lg"
            className="group relative bg-gradient-to-br from-white/10 via-white/5 to-transparent backdrop-blur-xl border border-white/20 hover:border-neon-green/60 text-transparent bg-clip-text font-black text-sm sm:text-base px-5 sm:px-6 py-2.5 sm:py-3 h-auto rounded-xl sm:rounded-2xl shadow-lg sm:shadow-xl shadow-black/50 hover:shadow-neon-green/30 transition-all duration-500 sm:duration-700 hover:scale-105 sm:hover:scale-110 hover:-translate-y-0.5 sm:hover:-translate-y-1 overflow-hidden before:absolute before:inset-0 before:bg-gradient-to-r before:from-transparent before:via-neon-green/20 before:to-transparent before:translate-x-[-100%] hover:before:translate-x-[100%] before:transition-transform before:duration-1000 after:absolute after:inset-0 after:bg-gradient-to-br after:from-neon-green/10 after:via-transparent after:to-neon-cyan/10 after:opacity-0 hover:after:opacity-100 after:transition-opacity after:duration-500"
            onClick={() => window.location.href = '/app'}
          >
            {/* Animated background particles - simplified for mobile */}
            <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-neon-green rounded-full animate-ping"></div>
              <div className="absolute top-3/4 right-1/4 w-1 h-1 bg-neon-cyan rounded-full animate-ping [animation-delay:0.5s]"></div>
              <div className="absolute top-1/2 left-1/2 w-0.5 h-0.5 bg-neon-magenta rounded-full animate-ping [animation-delay:1s]"></div>
            </div>

            <span className="relative z-10 bg-gradient-to-r from-white via-neon-green to-neon-cyan bg-clip-text text-transparent font-black text-sm sm:text-base tracking-wider">
              ENTER THE TRENCH
            </span>

            {/* Border glow animation - only on larger screens */}
            <div className="hidden sm:block absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500">
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-neon-green via-neon-cyan to-neon-magenta animate-spin opacity-20" style={{animationDuration: '3s'}}></div>
            </div>
          </Button>
        </div>

        {/* Social Links - Simple text links */}
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 sm:gap-6">
          <a
            href="https://x.com/Trenchmarket_"
            className="flex items-center gap-2 text-muted-foreground hover:text-neon-cyan transition-colors duration-300 group"
            target="_blank"
            rel="noopener noreferrer"
          >
            <XLogo className="w-5 h-5 group-hover:text-neon-cyan transition-colors" />
            <span className="text-sm sm:text-base font-medium underline underline-offset-4 decoration-1 hover:decoration-neon-cyan transition-all">Follow on X</span>
          </a>

          <a
            href="https://discord.gg/FnQ7y4pj"
            className="flex items-center gap-2 text-muted-foreground hover:text-neon-magenta transition-colors duration-300 group"
            target="_blank"
            rel="noopener noreferrer"
          >
            <DiscordIcon className="w-5 h-5 group-hover:text-neon-magenta transition-colors" />
            <span className="text-sm sm:text-base font-medium underline underline-offset-4 decoration-1 hover:decoration-neon-magenta transition-all">Join Discord</span>
          </a>
        </div>

        {/* Docs Link */}
        <div className="mt-6 sm:mt-8">
          <a
            href="/docs"
            className="flex items-center gap-2 text-muted-foreground hover:text-neon-cyan transition-colors duration-300 group"
          >
            <DocsIcon className="w-5 h-5 group-hover:text-neon-cyan transition-colors" />
            <span className="text-sm sm:text-base font-medium underline underline-offset-4 decoration-1 hover:decoration-neon-cyan transition-all">Documentation</span>
          </a>
        </div>
      </div>
    </div>
  )
}
