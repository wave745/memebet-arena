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
  SolflareWalletAdapter,
  BackpackWalletAdapter,
  GlowWalletAdapter,
  BraveWalletAdapter,
  CoinbaseWalletAdapter,
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

  // RPC endpoint from environment variable only
  const getEndpoint = () => {
    // Use the RPC URL from environment variable
    if (process.env.NEXT_PUBLIC_RPC_URL) {
      // If it's a Helius URL, ensure API key is included
      if (process.env.NEXT_PUBLIC_RPC_URL.includes('helius')) {
        // Check if API key is already in the URL
        if (process.env.NEXT_PUBLIC_RPC_URL.includes('api-key')) {
          return process.env.NEXT_PUBLIC_RPC_URL
        }
        // If not, add the API key
        if (process.env.NEXT_PUBLIC_HELIUS_API_KEY) {
          return `${process.env.NEXT_PUBLIC_RPC_URL}?api-key=${process.env.NEXT_PUBLIC_HELIUS_API_KEY}`
        }
      }
      return process.env.NEXT_PUBLIC_RPC_URL
    }

    // If no RPC URL is set, use the default mainnet endpoint
    console.warn("⚠️ No NEXT_PUBLIC_RPC_URL set, using default mainnet RPC")
    return "https://api.mainnet-beta.solana.com"
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
      console.warn("🔌 Wallet disconnected:", error.message)
      return
    }
    if (error.name === 'WalletNotFoundError') {
      console.warn("👛 Wallet not found:", error.message)
      return
    }
    if (error.name === 'WalletConnectionError' && error.message?.includes('User rejected')) {
      console.log("❌ User rejected wallet connection")
      return
    }

    console.error("🚨 Wallet Error:", error.name, error.message)
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

  // Fetch balance with improved error handling and connection recovery
  useEffect(() => {
    let mounted = true
    let intervalId: NodeJS.Timeout
    let consecutiveFailures = 0

    const fetchBalance = async (retryCount = 0) => {
      if (!publicKey || !connection || !mounted) {
        if (mounted) setSolBalance(0)
        return
      }

      try {
        const balance = await connection.getBalance(publicKey, {
          commitment: 'confirmed',
        })
        if (mounted) {
          setSolBalance(balance / LAMPORTS_PER_SOL)
          consecutiveFailures = 0 // Reset failure count on success
        }
      } catch (err: any) {
        console.warn("Balance fetch failed:", err?.message || err)

        // Check if it's a connection issue
        if (err?.message?.includes('Failed to fetch') || err?.message?.includes('ERR_CONNECTION')) {
          console.log("🔄 Connection issue detected, will retry...")

          if (retryCount < 5 && mounted) {
            const delay = Math.min(Math.pow(2, retryCount) * 1000, 10000) // Cap at 10s
            console.log(`⏳ Retrying balance fetch in ${delay}ms (attempt ${retryCount + 1}/5)`)
            setTimeout(() => fetchBalance(retryCount + 1), delay)
          } else if (mounted) {
            consecutiveFailures++
            if (consecutiveFailures >= 3) {
              console.warn("⚠️ Multiple balance fetch failures, keeping last known balance")
              // Don't set to 0, keep last known balance
            } else {
              setSolBalance(0)
            }
          }
        } else {
          // Other types of errors (like account not found)
          if (mounted) {
            consecutiveFailures++
            if (consecutiveFailures >= 3) {
              console.warn("⚠️ Account balance unavailable")
            } else {
              setSolBalance(0)
            }
          }
        }
      }
    }

    if (connected && publicKey) {
      // Initial fetch
      fetchBalance()

      // Poll balance every 60 seconds (reduced frequency to avoid rate limits)
      intervalId = setInterval(fetchBalance, 60000)
    } else {
      setSolBalance(0)
    }

    return () => {
      mounted = false
      if (intervalId) clearInterval(intervalId)
    }
  }, [publicKey, connected, connection])

  // Auto-connect wallet on page load/navigation with improved error handling
  useEffect(() => {
    // Only run this once per page load
    if (isInitializing) {
      const autoConnectWallet = async () => {
        try {
          // Check for previously connected wallet using correct localStorage key
          const walletState = localStorage.getItem('trench-market-wallet')

          if (walletState && !connected) {
            console.log('🔄 Attempting to auto-connect wallet...')

            // Parse wallet state to get wallet name
            const parsedState = JSON.parse(walletState)
            if (parsedState?.walletName) {
              console.log(`🔌 Auto-connecting to ${parsedState.walletName}...`)

              // Wait for wallet adapter to be ready
              let attempts = 0
              const maxAttempts = 10

              while (attempts < maxAttempts && !solanaWallet?.adapter) {
                await new Promise(resolve => setTimeout(resolve, 200))
                attempts++
              }

              if (solanaWallet?.adapter) {
                await solanaConnect()
                console.log('✅ Wallet auto-connected successfully')
              } else {
                console.warn('⚠️ Wallet adapter not ready for auto-connect')
              }
            }
          } else if (!walletState) {
            console.log('ℹ️ No previously connected wallet found')
          }
        } catch (error) {
          console.warn('❌ Auto-connect failed:', error)
          // Clear potentially corrupted wallet state
          localStorage.removeItem('trench-market-wallet')
        } finally {
          setIsInitializing(false)
        }
      }

      // Delay to ensure all adapters are initialized
      const timer = setTimeout(autoConnectWallet, 500)

      return () => clearTimeout(timer)
    }
  }, [connected, solanaConnect, solanaWallet?.adapter, isInitializing])

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

  // Manual reconnect function for troubleshooting
  const manualReconnect = useCallback(async () => {
    try {
      console.log('🔄 Manual wallet reconnect attempt...')
      if (!connected) {
        await solanaConnect()
        console.log('✅ Manual reconnect successful')
      } else {
        console.log('ℹ️ Wallet already connected')
      }
    } catch (error) {
      console.error('❌ Manual reconnect failed:', error)
      throw error
    }
  }, [connected, solanaConnect])

  const contextValue: WalletContextType = useMemo(() => ({
    walletConnected: connected,
    walletAddress: publicKey?.toString() || null,
    solBalance,
    connection,
    wallet: anchorWallet,
    connect: async () => {
      console.log('🔗 Attempting wallet connection...')
      try {
        await manualReconnect()
        console.log('✅ Wallet connection successful')
      } catch (error) {
        console.error('❌ Wallet connection failed:', error)
        throw error
      }
    },
    disconnect: async () => {
      console.log('🔌 Disconnecting wallet...')
      await solanaDisconnect()
      // Clear wallet state
      localStorage.removeItem('trench-market-wallet')
      console.log('✅ Wallet disconnected and state cleared')
    }
  }), [connected, publicKey, solBalance, connection, anchorWallet, solanaDisconnect, manualReconnect])

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
