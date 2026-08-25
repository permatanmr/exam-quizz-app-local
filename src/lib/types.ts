export type QuestionOption = {
  id: string; // "A" | "B" | "C" | "D" | "E"
  text: string;
};

export type QuestionRow = {
  id: string;
  exam_id: string;
  text: string;
  options: string; // JSON string of QuestionOption[]
  correct_option_id: string;
  explanation: string;
  order_index: number;
  points: number;
  source: "manual" | "ai";
  created_at: string;
};

export type Question = Omit<QuestionRow, "options"> & {
  options: QuestionOption[];
};

export type QuestionPublic = Omit<Question, "correct_option_id" | "explanation"> & {
  correct_option_id?: never;
};

export type ExamRow = {
  id: string;
  dosen_id: string;
  title: string;
  description: string;
  code: string;
  duration_minutes: number;
  shuffle_questions: number;
  shuffle_options: number;
  allow_retake: number;
  show_result_to_student: number;
  status: "draft" | "published" | "closed";
  created_at: string;
  updated_at: string;
};

export type Exam = ExamRow;

export type AttemptRow = {
  id: string;
  exam_id: string;
  student_name: string;
  student_nim: string;
  started_at: string;
  submitted_at: string | null;
  score: number | null;
  total_questions: number | null;
  correct_count: number | null;
  status: "in_progress" | "submitted";
  question_order: string;
};

export type DosenRow = {
  id: string;
  name: string;
  email: string;
  password_hash: string;
  created_at: string;
};

export type SessionPayload = {
  dosenId: string;
  email: string;
  name: string;
};
