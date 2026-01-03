"use client"

import React, { FC, useMemo, createContext, useContext, useState, useEffect, useCallback } from "react"
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js"
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection as useSolanaWalletConnection,
} from "@solana/wallet-adapter-react"
import { WalletAdapterNetwork, WalletError } from "@solana/wallet-adapter-base"
import {
  WalletModalProvider,
} from "@solana/wallet-adapter-react-ui"
import {
  PhantomWalletAdapter,
} from "@solana/wallet-adapter-wallets"
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
  // Always use Mainnet for production deployment
  const network = WalletAdapterNetwork.Mainnet

  // RPC endpoint with fallback options for reliability
  const getEndpoint = () => {
    // Use environment variable if set
    if (process.env.NEXT_PUBLIC_RPC_URL) {
      return process.env.NEXT_PUBLIC_RPC_URL
    }

    // Production mainnet - require paid RPC provider
    if (network === WalletAdapterNetwork.Mainnet) {
      console.warn("⚠️ Using default mainnet RPC. For production, set NEXT_PUBLIC_RPC_URL to a paid provider like Helius!")
      return "https://api.mainnet-beta.solana.com"
    }

    // Development - use devnet
    return "https://api.devnet.solana.com"
  }

  const endpoint = getEndpoint()

  // Minimal wallet configuration to avoid MetaMask conflicts
  const wallets = useMemo(
    () => [
      // Only include Phantom for now to test if this resolves the MetaMask key collision
      new PhantomWalletAdapter(),
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
      <SolanaWalletProvider wallets={wallets} autoConnect localStorageKey="trench-market-wallet" onError={onError}>
        <WalletModalProvider>
          <WalletStateWrapper>{children}</WalletStateWrapper>
        </WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  )
}

const WalletStateWrapper: FC<{ children: React.ReactNode }> = ({ children }) => {
  const { connection } = useSolanaWalletConnection()
  const { publicKey, connected, disconnect: solanaDisconnect, wallet: solanaWallet, connect: solanaConnect } = useSolanaWallet()
  const [solBalance, setSolBalance] = useState(0)
  const [anchorWallet, setAnchorWallet] = useState<anchor.Wallet | null>(null)
  const [isInitializing, setIsInitializing] = useState(true)

  // Fetch balance with debounce/interval
  useEffect(() => {
    let mounted = true
    let intervalId: NodeJS.Timeout

    const fetchBalance = async (retryCount = 0) => {
      if (publicKey && connection) {
        try {
          const balance = await connection.getBalance(publicKey)
          if (mounted) setSolBalance(balance / LAMPORTS_PER_SOL)
        } catch (err) {
          console.error("Failed to fetch balance:", err)

          // Retry up to 3 times with exponential backoff
          if (retryCount < 3 && mounted) {
            const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
            console.log(`Retrying balance fetch in ${delay}ms (attempt ${retryCount + 1}/3)`)
            setTimeout(() => fetchBalance(retryCount + 1), delay)
          } else if (mounted) {
            // If all retries failed, set balance to 0 and log warning
            console.warn("Balance fetch failed after 3 retries, setting to 0")
            setSolBalance(0)
          }
        }
      } else {
        if (mounted) setSolBalance(0)
      }
    }

    if (connected && publicKey) {
      fetchBalance()
      // Poll balance less frequently (30s) to save resources
      intervalId = setInterval(fetchBalance, 30000)
    }

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [publicKey, connected, connection])

  // Auto-connect wallet on page load/navigation
  useEffect(() => {
    // Only run this once per page load
    if (isInitializing) {
      const autoConnectWallet = async () => {
        try {
          // Check if we have a previously connected wallet
          const hasConnectedWallet = localStorage.getItem('walletName')

          if (hasConnectedWallet && !connected) {
            console.log('Attempting to auto-connect wallet...')
            await solanaConnect()
          }
        } catch (error) {
          console.warn('Auto-connect failed:', error)
        } finally {
          setIsInitializing(false)
        }
      }

      // Small delay to ensure wallet adapter is ready
      const timer = setTimeout(autoConnectWallet, 100)

      return () => clearTimeout(timer)
    }
  }, [connected, solanaConnect, isInitializing])

  // Setup Anchor Wallet - Memoize to prevent frequent re-creation
  useEffect(() => {
    if (publicKey && connected && solanaWallet?.adapter) {
      const adapter = solanaWallet.adapter

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
    }
  }, [publicKey, connected, solanaWallet])

  const contextValue: WalletContextType = useMemo(() => ({
    walletConnected: connected,
    walletAddress: publicKey?.toString() || null,
    solBalance,
    connection,
    wallet: anchorWallet,
    connect: async () => { }, // Handled by Modal
    disconnect: async () => {
      await solanaDisconnect()
    }
  }), [connected, publicKey, solBalance, connection, anchorWallet, solanaDisconnect])

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
