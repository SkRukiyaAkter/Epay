import crypto from "crypto";

const TRANSACTION_INFO = Buffer.from("epayment-transaction-v1");

export function deriveK1(
  activationCodeHash: string,
  nidHash: string,
  browserFingerprint: string
): Buffer {
  const nidRaw = crypto.createHash("sha256").update(nidHash, "utf8").digest();
  const fpRaw = crypto
    .createHash("sha256")
    .update(browserFingerprint, "utf8")
    .digest();
  const msg = Buffer.concat([nidRaw, fpRaw]);
  return crypto
    .createHmac("sha256", Buffer.from(activationCodeHash, "utf8"))
    .update(msg)
    .digest();
}

export function deriveAesKey(
  k2: string,
  sessionSecret: string,
  tCurrent: string,
  nonce: string
): Buffer {
  const ikm = Buffer.concat([
    Buffer.from(k2, "utf8"),
    Buffer.from(sessionSecret, "utf8"),
    Buffer.from(tCurrent, "utf8"),
  ]);

  const salt = Buffer.from(nonce.slice(0, 32).padEnd(32, "\0"), "utf8");

  return crypto.hkdfSync("sha256", ikm, salt, TRANSACTION_INFO, 32) as unknown as Buffer;
}

export function computeHmac(k1Hex: string, message: string): string {
  const hmac = crypto.createHmac("sha256", Buffer.from(k1Hex, "hex"));
  hmac.update(message, "utf8");
  return hmac.digest("base64");
}

export function encryptPayload(params: {
  senderUsername: string;
  receiverUsername: string;
  amount: string;
  currency: string;
  k2: string;
  sessionSecret: string;
  tCurrent: string;
  tVersion: number;
  activationCodeHash: string;
  nidHash: string;
  browserFingerprint: string;
}): { encryptedPayload: string; nonce: string } {
  const nonce = crypto.randomUUID();

  const M = JSON.stringify({
    sender_username: params.senderUsername,
    receiver_username: params.receiverUsername,
    amount: params.amount,
    currency: params.currency,
    timestamp: new Date().toISOString(),
    nonce,
  });

  const k1 = deriveK1(
    params.activationCodeHash,
    params.nidHash,
    params.browserFingerprint
  );

  const f1 = computeHmac(k1.toString("hex"), M);

  // Derive AES key
  const aesKey = deriveAesKey(
    params.k2,
    params.sessionSecret,
    params.tCurrent,
    nonce
  );

  // Encrypt M + F1
  const iv = crypto.randomBytes(12);
  const plaintext = Buffer.from(M + "|" + f1, "utf8");
  const aad = Buffer.from(params.senderUsername + params.tVersion, "utf8");

  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey, iv);
  cipher.setAAD(aad);

  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // IV (12 bytes) || ciphertext || authTag (16 bytes)
  const combined = Buffer.concat([iv, ciphertext, authTag]);

  return {
    encryptedPayload: combined.toString("base64"),
    nonce,
  };
}

export function hashSha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}
