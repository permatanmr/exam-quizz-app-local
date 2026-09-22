export type QuestionType = "multiple_choice" | "coding";

export type QuestionOption = {
  id: string; // "A" | "B" | "C" | "D" | "E"
  text: string;
};

export type CodingTestCase = {
  input: string;
  expected_output: string;
  expectedOutput?: string;
};

export type QuestionRow = {
  id: string;
  exam_id: string;
  question_type: QuestionType;
  text: string;
  options: string; // JSON string of QuestionOption[]
  correct_option_id: string;
  explanation: string;
  order_index: number;
  points: number;
  source: "manual" | "ai";
  coding_language: string | null;
  coding_prompt: string | null;
  coding_starter_code: string | null;
  coding_solution_code: string | null;
  coding_test_cases: string | null;
  coding_expected_output_type: string | null;
  created_at: string;
};

export type Question = Omit<QuestionRow, "options" | "coding_test_cases"> & {
  options: QuestionOption[];
  coding_test_cases: CodingTestCase[];
};

export type QuestionPublic = Omit<
  Question,
  "correct_option_id" | "explanation"
> & {
  correct_option_id?: never;
  answer_text?: string | null;
};

export type ExamLanguage = "indonesia" | "inggris" | "korea" | "jepang";

export type ExamRow = {
  id: string;
  dosen_id: string;
  title: string;
  description: string;
  code: string;
  language: ExamLanguage;
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
