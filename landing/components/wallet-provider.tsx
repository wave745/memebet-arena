"use client"

import React, { FC, createContext, useContext } from "react"
import { Connection, PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

// Simplified wallet context for landing page - no actual wallet functionality needed
interface WalletContextType {
  walletConnected: boolean
  walletAddress: string | null
  solBalance: number
  connection: Connection | null
  wallet: anchor.Wallet | null
  connect: () => Promise<void>
  disconnect: () => Promise<void>
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export const WalletProvider: FC<{ children: React.ReactNode }> = ({ children }) => {
  // Landing page provides minimal wallet context - actual wallet functionality is on main app
  const contextValue: WalletContextType = {
    walletConnected: false,
    walletAddress: null,
    solBalance: 0,
    connection: null,
    wallet: null,
    connect: async () => {
      // Redirect to main app for wallet connection
      window.location.href = 'https://arena.trench-market.fun/app'
    },
    disconnect: async () => {
      // No-op for landing page
    }
  }

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  )
}

export function useWallet() {
  const context = useContext(WalletContext)
  if (context === undefined) {
    throw new Error("useWallet must be used within WalletProvider")
  }
  return context
}
