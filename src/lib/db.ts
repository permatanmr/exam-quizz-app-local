import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const dataDir = path.join(process.cwd(), "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "exam.db");

declare global {
  var __examDb: Database.Database | undefined;
}

function createConnection() {
  const conn = new Database(dbPath);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  return conn;
}

export const db = global.__examDb ?? createConnection();

if (process.env.NODE_ENV !== "production") {
  global.__examDb = db;
}

function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS dosen (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS exam (
      id TEXT PRIMARY KEY,
      dosen_id TEXT NOT NULL REFERENCES dosen(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      code TEXT UNIQUE NOT NULL,
      language TEXT NOT NULL DEFAULT 'indonesia',
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      shuffle_questions INTEGER NOT NULL DEFAULT 1,
      shuffle_options INTEGER NOT NULL DEFAULT 0,
      allow_retake INTEGER NOT NULL DEFAULT 0,
      show_result_to_student INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'draft',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS question (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
      question_type TEXT NOT NULL DEFAULT 'multiple_choice',
      text TEXT NOT NULL,
      options TEXT NOT NULL,
      correct_option_id TEXT NOT NULL DEFAULT '',
      explanation TEXT NOT NULL DEFAULT '',
      order_index INTEGER NOT NULL,
      points REAL NOT NULL DEFAULT 1,
      source TEXT NOT NULL DEFAULT 'manual',
      coding_language TEXT,
      coding_prompt TEXT,
      coding_starter_code TEXT,
      coding_solution_code TEXT,
      coding_test_cases TEXT,
      coding_expected_output_type TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS attempt (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL REFERENCES exam(id) ON DELETE CASCADE,
      student_name TEXT NOT NULL,
      student_nim TEXT NOT NULL,
      started_at TEXT NOT NULL,
      submitted_at TEXT,
      score REAL,
      total_questions INTEGER,
      correct_count INTEGER,
      status TEXT NOT NULL DEFAULT 'in_progress',
      question_order TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS attempt_answer (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL REFERENCES attempt(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL REFERENCES question(id) ON DELETE CASCADE,
      selected_option_id TEXT,
      answer_text TEXT,
      is_correct INTEGER,
      answered_at TEXT NOT NULL,
      UNIQUE(attempt_id, question_id)
    );

    CREATE INDEX IF NOT EXISTS idx_question_exam ON question(exam_id);
    CREATE INDEX IF NOT EXISTS idx_attempt_exam ON attempt(exam_id);
    CREATE INDEX IF NOT EXISTS idx_attempt_answer_attempt ON attempt_answer(attempt_id);
  `);

  const examColumns = db.prepare("PRAGMA table_info(exam)").all() as {
    name: string;
  }[];
  if (!examColumns.some((column) => column.name === "language")) {
    db.exec(
      "ALTER TABLE exam ADD COLUMN language TEXT NOT NULL DEFAULT 'indonesia'",
    );
  }

  const questionColumns = db.prepare("PRAGMA table_info(question)").all() as {
    name: string;
  }[];
  if (!questionColumns.some((column) => column.name === "question_type")) {
    db.exec(
      "ALTER TABLE question ADD COLUMN question_type TEXT NOT NULL DEFAULT 'multiple_choice'",
    );
  }
  if (!questionColumns.some((column) => column.name === "coding_language")) {
    db.exec("ALTER TABLE question ADD COLUMN coding_language TEXT");
  }
  if (!questionColumns.some((column) => column.name === "coding_prompt")) {
    db.exec("ALTER TABLE question ADD COLUMN coding_prompt TEXT");
  }
  if (
    !questionColumns.some((column) => column.name === "coding_starter_code")
  ) {
    db.exec("ALTER TABLE question ADD COLUMN coding_starter_code TEXT");
  }
  if (
    !questionColumns.some((column) => column.name === "coding_solution_code")
  ) {
    db.exec("ALTER TABLE question ADD COLUMN coding_solution_code TEXT");
  }
  if (!questionColumns.some((column) => column.name === "coding_test_cases")) {
    db.exec("ALTER TABLE question ADD COLUMN coding_test_cases TEXT");
  }
  if (
    !questionColumns.some(
      (column) => column.name === "coding_expected_output_type",
    )
  ) {
    db.exec("ALTER TABLE question ADD COLUMN coding_expected_output_type TEXT");
  }

  const attemptAnswerColumns = db
    .prepare("PRAGMA table_info(attempt_answer)")
    .all() as {
    name: string;
  }[];
  if (!attemptAnswerColumns.some((column) => column.name === "answer_text")) {
    db.exec("ALTER TABLE attempt_answer ADD COLUMN answer_text TEXT");
  }

  db.exec("UPDATE exam SET shuffle_questions = 1 WHERE shuffle_questions != 1");
}

migrate();

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}
