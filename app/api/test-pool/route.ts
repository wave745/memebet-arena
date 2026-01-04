'use server'

import { NextResponse } from "next/server"
import { Pool } from '@neondatabase/serverless'

export async function GET() {
    console.log("Testing pool creation...")
    try {
        console.log("DATABASE_URL available:", !!process.env.DATABASE_URL)
        console.log("URL preview:", process.env.DATABASE_URL?.substring(0, 20))

        const pool = new Pool({
            connectionString: process.env.DATABASE_URL,
        })
        console.log("Pool created successfully")

        // Don't actually connect, just test creation
        return NextResponse.json({
            success: true,
            message: "Pool creation successful"
        })
    } catch (error: any) {
        console.error("Pool creation failed:", error)
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 })
    }
}