import { NextRequest, NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/session";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const token = session.accessToken;

    if (token) {
      // Notify Flask to blacklist
      await fetch(`${API_BASE}/api/v1/auth/logout`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
    }

    await destroySession(session);
    return NextResponse.json({ logged_out: true });
  } catch (err) {
    console.error("Logout error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
