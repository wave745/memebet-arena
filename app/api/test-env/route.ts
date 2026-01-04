import { NextResponse } from "next/server"

export async function GET() {
    return NextResponse.json({
        DATABASE_URL: process.env.DATABASE_URL ? "SET" : "NOT SET",
        NEXT_PUBLIC_RPC_URL: process.env.NEXT_PUBLIC_RPC_URL ? "SET" : "NOT SET",
        NEXT_PUBLIC_HELIUS_API_KEY: process.env.NEXT_PUBLIC_HELIUS_API_KEY ? "SET" : "NOT SET",
        NODE_ENV: process.env.NODE_ENV,
        hasEnvFile: process.env.DATABASE_URL?.includes("neondb") ? "YES" : "NO"
    })
}