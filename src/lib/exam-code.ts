import { db } from "./db";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // tanpa 0,O,1,I agar mudah dibaca

function randomCode(length = 6) {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return out;
}

export function generateUniqueExamCode(): string {
  for (let i = 0; i < 50; i++) {
    const code = randomCode(6);
    const existing = db.prepare("SELECT id FROM exam WHERE code = ?").get(code);
    if (!existing) return code;
  }
  throw new Error("Gagal membuat kode ujian unik, coba lagi.");
}
