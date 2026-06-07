import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession, getCsrfToken, setCsrfCookie } from "@/lib/session";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400 }
      );
    }

    const flaskRes = await fetch(`${API_BASE}/api/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    const data = await flaskRes.json();

    if (!flaskRes.ok) {
      return NextResponse.json(data, { status: flaskRes.status });
    }

    // Store in encrypted server session
    const session = await getSession();
    await saveSession(session, {
      isLoggedIn: true,
      userId: data.user_id,
      username: username,
      deviceId: data.device_id,
      accessToken: data.session_token,
      tCurrent: data.t_current,
      tVersion: data.t_version,
      k2Encrypted: data.k2_encrypted || "",
      sessionSecretEncrypted: data.session_secret_encrypted || "",
      k2Raw: data.k2_raw || "",
      sessionSecretRaw: data.session_secret_raw || "",
      activationCodeHash: data.activation_code_hash || "",
      nidHash: data.nid_hash || "",
      browserFingerprint: data.browser_fingerprint || "",
    });

    const csrfToken = await getCsrfToken();
    await setCsrfCookie(csrfToken);

    return NextResponse.json({
      success: true,
      username: username,
      user_id: data.user_id,
    });
  } catch (err) {
    console.error("Login error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
