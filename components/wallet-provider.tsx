"use client"

import React, { FC, useMemo, createContext, useContext, useState, useEffect, useCallback } from "react"
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
} from "@solana/wallet-adapter-react"
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base"
import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui"
import * as anchor from "@coral-xyz/anchor"

// Polyfill Buffer for Solana libraries in browser
if (typeof window !== "undefined" && typeof window.Buffer === "undefined") {
  try {
    // Use dynamic import to avoid SSR issues
    import("buffer").then(({ Buffer }) => {
      window.Buffer = Buffer
    }).catch(() => {
      // Fallback: try require if import fails
      if (typeof require !== "undefined") {
        const { Buffer } = require("buffer")
        window.Buffer = Buffer
      }
    })
  } catch (e) {
    // Silently fail - Buffer might already be polyfilled
  }
}

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
  const network = WalletAdapterNetwork.Devnet
  const endpoint = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"

  // Explicitly include main wallets and allow Standard discovery
  const wallets = useMemo(
    () => [
    ],
    [network]
  )

  const onError = useCallback((error: WalletError) => {
    // Suppress common non-fatal errors to prevent console noise
    if (error.name === 'WalletDisconnectedError') {
      console.warn("Wallet Context: Disconnected.", error.message)
      return
    }
    console.error("Wallet Error:", error)
  }, [])

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>
          <WalletStateWrapper>{children}</WalletStateWrapper>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}

const WalletStateWrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { publicKey, connected, disconnect: solanaDisconnect, wallet: solanaWallet } = useSolanaWallet()
  const [solBalance, setSolBalance] = useState(0)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [anchorWallet, setAnchorWallet] = useState<anchor.Wallet | null>(null)

  useEffect(() => {
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"
    setConnection(new Connection(rpcUrl, "confirmed"))
  }, [])

  useEffect(() => {
    let mounted = true

    if (publicKey && connected && solanaWallet?.adapter && connection) {
      const updateBalance = async () => {
        try {
          const balance = await connection.getBalance(publicKey)
          if (mounted) setSolBalance(balance / LAMPORTS_PER_SOL)
        } catch (err) {
          console.error("Failed to fetch balance:", err)
        }
      }

      updateBalance()

      const adapter = solanaWallet.adapter
      // Set up Anchor Wallet
      const walletObj = {
        publicKey: publicKey,
        signTransaction: async (tx: anchor.web3.Transaction) => {
          if (adapter && 'signTransaction' in adapter) {
            return await (adapter as any).signTransaction(tx)
          }
          throw new Error("Wallet does not support transaction signing")
        },
        signAllTransactions: async (txs: anchor.web3.Transaction[]) => {
          if (adapter && 'signAllTransactions' in adapter) {
            return await (adapter as any).signAllTransactions(txs)
          }
          throw new Error("Wallet does not support multiple transaction signing")
        },
      }
      setAnchorWallet(walletObj as anchor.Wallet)
    } else {
      setAnchorWallet(null)
      setSolBalance(0)
    }

    return () => { mounted = false }
  }, [publicKey, connected, connection, solanaWallet])

  const contextValue: WalletContextType = {
    walletConnected: connected,
    walletAddress: publicKey?.toString() || null,
    solBalance,
    connection,
    wallet: anchorWallet,
    connect: async () => { }, // Handled by Modal
    disconnect: async () => {
      await solanaDisconnect()
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
