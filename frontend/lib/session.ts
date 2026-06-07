import { getIronSession, IronSession, SessionOptions } from "iron-session";
import { cookies } from "next/headers";
import { UserSession } from "@/types";

const sessionOptions: SessionOptions = {
  password: process.env.SESSION_SECRET!,
  cookieName: "epayment-session",
  cookieOptions: {
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    maxAge: 60 * 60,
  },
};

export async function getSession(): Promise<IronSession<UserSession>> {
  const cookieStore = await cookies();
  return getIronSession<UserSession>(cookieStore, sessionOptions);
}

export async function saveSession(
  session: IronSession<UserSession>,
  data: Partial<UserSession>
) {
  Object.assign(session, data);
  await session.save();
}

export async function destroySession(session: IronSession<UserSession>) {
  session.destroy();
}

export async function getCsrfToken(): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get("csrf-token")?.value;
  if (existing) return existing;
  const token = crypto.randomUUID();
  return token;
}

export async function setCsrfCookie(token: string) {
  const cookieStore = await cookies();
  cookieStore.set("csrf-token", token, {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60,
    path: "/",
  });
}

export async function validateCsrf(request: Request): Promise<boolean> {
  const cookieStore = await cookies();
  const csrfCookie = cookieStore.get("csrf-token")?.value;
  const csrfHeader = request.headers.get("X-CSRF-Token");
  if (!csrfCookie || !csrfHeader) return false;
  return csrfCookie === csrfHeader;
}
