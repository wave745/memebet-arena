import type React from "react"
import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import "./globals.css"
import { WalletProvider } from "@/components/wallet-provider"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Trenchmarket - Solana Prediction Markets",
  description: "Belief markets on Solana memecoins. Fast, degenerate, based.",
  icons: {
    icon: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👾</text></svg>",
    apple: "data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👾</text></svg>",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased shining-bg`}>
        {/* Background Effects */}
        <div className="fixed inset-0 glass-grid opacity-20 pointer-events-none z-[-2]" />
        <div className="noise-filter" />

        {/* Background Shine Orbs */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none z-[-1]">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-neon-green/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-neon-magenta/10 rounded-full blur-[120px] animate-pulse [animation-delay:1s]" />
          <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] bg-neon-cyan/5 rounded-full blur-[100px] animate-pulse [animation-delay:2s]" />
        </div>
        <WalletProvider>{children}</WalletProvider>
      </body>
    </html>
  )
}
