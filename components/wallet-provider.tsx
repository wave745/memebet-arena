"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import { Connection, PublicKey } from "@solana/web3.js"
import * as anchor from "@coral-xyz/anchor"

interface WalletContextType {
  walletConnected: boolean
  walletAddress: string | null
  solBalance: number
  connection: Connection | null
  wallet: anchor.Wallet | null
  connect: () => Promise<void>
  disconnect: () => void
}

const WalletContext = createContext<WalletContextType | undefined>(undefined)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string | null>(null)
  const [solBalance, setSolBalance] = useState(0)
  const [connection, setConnection] = useState<Connection | null>(null)
  const [wallet, setWallet] = useState<anchor.Wallet | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    // Initialize connection
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://api.devnet.solana.com"
    setConnection(new Connection(rpcUrl, "confirmed"))
    checkWalletConnection()
  }, [])

  useEffect(() => {
    if (walletAddress && connection) {
      // Create wallet adapter
      const walletAdapter = {
        publicKey: new PublicKey(walletAddress),
        signTransaction: async (tx: anchor.web3.Transaction) => {
          if (typeof window !== "undefined" && (window as any).solana) {
            const signed = await (window as any).solana.signTransaction(tx)
            return signed
          }
          throw new Error("Wallet not connected")
        },
        signAllTransactions: async (txs: anchor.web3.Transaction[]) => {
          if (typeof window !== "undefined" && (window as any).solana) {
            const signed = await (window as any).solana.signAllTransactions(txs)
            return signed
          }
          throw new Error("Wallet not connected")
        },
      }
      setWallet(walletAdapter as anchor.Wallet)
      
      // Update balance
      updateBalance()
    } else {
      setWallet(null)
    }
  }, [walletAddress, connection])

  const updateBalance = async () => {
    if (walletAddress && connection) {
      try {
        const balance = await connection.getBalance(new PublicKey(walletAddress))
        setSolBalance(balance / anchor.web3.LAMPORTS_PER_SOL)
      } catch (err) {
        console.error("Failed to fetch balance:", err)
      }
    }
  }

  const checkWalletConnection = async () => {
    if (typeof window !== "undefined" && (window as any).solana) {
      try {
        const response = await (window as any).solana.connect({ onlyIfTrusted: true })
        setWalletAddress(response.publicKey.toString())
        setWalletConnected(true)
      } catch (err) {
        // Wallet not connected
      }
    }
  }

  const connect = async () => {
    if (typeof window !== "undefined" && (window as any).solana) {
      try {
        const response = await (window as any).solana.connect()
        setWalletAddress(response.publicKey.toString())
        setWalletConnected(true)
      } catch (err) {
        console.error("Wallet connection failed:", err)
      }
    } else {
      alert("Please install a Solana wallet (e.g., Phantom)")
    }
  }

  const disconnect = async () => {
    if (typeof window !== "undefined" && (window as any).solana) {
      try {
        await (window as any).solana.disconnect()
      } catch (err) {
        console.error("Disconnect failed:", err)
      }
    }
    setWalletAddress(null)
    setWalletConnected(false)
    setSolBalance(0)
    setWallet(null)
  }

  return (
    <WalletContext.Provider
      value={{
        walletConnected,
        walletAddress,
        solBalance,
        connection,
        wallet,
        connect,
        disconnect,
      }}
    >
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
