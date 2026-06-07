import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const token = session.accessToken;
    if (!token) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

    const body = await request.json();
    const flaskRes = await fetch(`${API_BASE}/api/v1/simulate/decrypt`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await flaskRes.json();
    return NextResponse.json(data, { status: flaskRes.status });
  } catch {
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
