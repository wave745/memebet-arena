import { NextResponse } from 'next/server';

export async function GET() {
  // This endpoint is for local debugging only
  // In production/Vercel, database direct access is not available
  return NextResponse.json({
    error: "Database debugging is only available in development environment",
    message: "This endpoint requires direct database access which is not available in serverless deployments",
    tip: "Run `npm run dev` locally to test database connections"
  }, { status: 503 });
}

export const runtime = 'nodejs'; // Optional: ensure Node.js runtime