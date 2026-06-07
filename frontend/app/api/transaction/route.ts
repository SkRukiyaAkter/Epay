import { NextRequest, NextResponse } from "next/server";
import { getSession, saveSession, validateCsrf } from "@/lib/session";
import {
  deriveK1,
  deriveAesKey,
  computeHmac,
  encryptPayload,
} from "@/lib/crypto";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

export async function POST(request: NextRequest) {
  try {
    if (!(await validateCsrf(request))) {
      return NextResponse.json({ error: "csrf_invalid" }, { status: 403 });
    }
    const session = await getSession();
    const token = session.accessToken;

    if (!token) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }

    const {
      k2Raw,
      sessionSecretRaw,
      activationCodeHash,
      nidHash,
      browserFingerprint,
      tCurrent,
      tVersion,
      username,
    } = session;

    if (!k2Raw || !sessionSecretRaw) {
      return NextResponse.json(
        { error: "missing_crypto_materials" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { receiver_username, amount, currency = "BDT" } = body;

    if (!receiver_username || !amount) {
      return NextResponse.json(
        { error: "missing_fields" },
        { status: 400 }
      );
    }

    const amountStr = String(amount);
    const parsedAmount = parseFloat(amountStr);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: "invalid_amount" },
        { status: 400 }
      );
    }

    const { encryptedPayload, nonce } = encryptPayload({
      senderUsername: username || "unknown",
      receiverUsername: receiver_username,
      amount: amountStr,
      currency,
      k2: k2Raw,
      sessionSecret: sessionSecretRaw,
      tCurrent: tCurrent || "",
      tVersion: tVersion || 0,
      activationCodeHash: activationCodeHash || "",
      nidHash: nidHash || "",
      browserFingerprint: browserFingerprint || "",
    });

    const flaskRes = await fetch(
      `${API_BASE}/api/v1/transaction/initiate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          encrypted_payload: encryptedPayload,
          nonce,
          declared_t_version: tVersion,
          device_id: session.deviceId,
        }),
      }
    );

    const data = await flaskRes.json();

    if (flaskRes.ok && data.status === "completed") {
      await saveSession(session, {
        tCurrent: data.t_next,
        tVersion: data.t_version_next,
      });
    }

    return NextResponse.json(data, { status: flaskRes.status });
  } catch (err) {
    console.error("Transaction error:", err);
    return NextResponse.json(
      { error: "internal_error" },
      { status: 500 }
    );
  }
}
