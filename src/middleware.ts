import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function buildCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  };
}

export function middleware(req: NextRequest) {
  if (req.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(),
    });
  }

  const response = NextResponse.next();
  const corsHeaders = buildCorsHeaders();

  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}

export const config = {
  matcher: "/api/:path*",
};
