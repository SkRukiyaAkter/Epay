import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession } from "@/lib/session";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const token = session.accessToken;

    if (!token) {
      return NextResponse.json({ error: "missing_token" }, { status: 401 });
    }

    const flaskRes = await fetch(`${API_BASE}/api/v1/auth/refresh`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await flaskRes.json();

    if (!flaskRes.ok) {
      return NextResponse.json(data, { status: flaskRes.status });
    }

    await saveSession(session, {
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

    return NextResponse.json({
      success: true,
      t_version: data.t_version,
    });
  } catch (err) {
    console.error("Refresh error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
