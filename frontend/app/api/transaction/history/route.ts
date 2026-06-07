import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    const token = session.accessToken;

    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = searchParams.get("page") || "1";
    const limit = searchParams.get("limit") || "20";

    const flaskRes = await fetch(
      `${API_BASE}/api/v1/transaction/history?page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await flaskRes.json();
    return NextResponse.json(data, { status: flaskRes.status });
  } catch (err) {
    console.error("History fetch error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
