import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import { db } from "./db";
import type { DosenRow, SessionPayload } from "./types";

const SESSION_COOKIE = "exam_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 hari

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET belum diatur. Tambahkan SESSION_SECRET di file .env.local"
    );
  }
  return secret;
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createSessionToken(payload: SessionPayload) {
  return jwt.sign(payload, getSecret(), { expiresIn: SESSION_MAX_AGE_SECONDS });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, getSecret()) as SessionPayload;
  } catch {
    return null;
  }
}

export async function setSessionCookie(payload: SessionPayload) {
  const token = createSessionToken(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function getCurrentDosen(): Promise<DosenRow | null> {
  const session = await getSession();
  if (!session) return null;
  const row = db
    .prepare("SELECT * FROM dosen WHERE id = ?")
    .get(session.dosenId) as DosenRow | undefined;
  return row ?? null;
}

export function countDosen(): number {
  const row = db.prepare("SELECT COUNT(*) as c FROM dosen").get() as { c: number };
  return row.c;
}
