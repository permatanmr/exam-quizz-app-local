import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const examLanguageSchema = z.enum([
  "indonesia",
  "inggris",
  "korea",
  "jepang",
]);

export const examCreateSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter"),
  description: z.string().trim().optional().default(""),
  language: examLanguageSchema.optional().default("indonesia"),
  duration_minutes: z.number().int().min(1).max(600),
  shuffle_questions: z.boolean().optional().default(false),
  shuffle_options: z.boolean().optional().default(false),
  allow_retake: z.boolean().optional().default(false),
  show_result_to_student: z.boolean().optional().default(true),
});

// Catatan: sengaja TIDAK dibuat dari examCreateSchema.partial(), karena field
// dengan .default() akan tetap disubstitusi dengan nilai default oleh Zod saat
// field tsb tidak dikirim, sehingga PATCH parsial (mis. hanya mengubah status)
// akan menimpa field lain dengan nilai default alih-alih mempertahankan nilai lama.
export const examUpdateSchema = z.object({
  title: z.string().trim().min(3, "Judul minimal 3 karakter").optional(),
  description: z.string().trim().optional(),
  language: examLanguageSchema.optional(),
  duration_minutes: z.number().int().min(1).max(600).optional(),
  shuffle_questions: z.boolean().optional(),
  shuffle_options: z.boolean().optional(),
  allow_retake: z.boolean().optional(),
  show_result_to_student: z.boolean().optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
});

const optionSchema = z.object({
  id: z.string().min(1),
  text: z.string().trim().min(1, "Teks opsi tidak boleh kosong"),
});

export const questionCreateSchema = z.object({
  text: z.string().trim().min(3, "Pertanyaan minimal 3 karakter"),
  options: z
    .array(optionSchema)
    .min(2, "Minimal 2 opsi")
    .max(6, "Maksimal 6 opsi"),
  correct_option_id: z.string().min(1),
  explanation: z.string().trim().optional().default(""),
  points: z.number().min(0).max(1000).optional().default(1),
});

// Sama seperti examUpdateSchema di atas: dibuat manual tanpa .default() agar
// PATCH parsial tidak menimpa field yang tidak dikirim dengan nilai default.
export const questionUpdateSchema = z.object({
  text: z.string().trim().min(3, "Pertanyaan minimal 3 karakter").optional(),
  options: z
    .array(optionSchema)
    .min(2, "Minimal 2 opsi")
    .max(6, "Maksimal 6 opsi")
    .optional(),
  correct_option_id: z.string().min(1).optional(),
  explanation: z.string().trim().optional(),
  points: z.number().min(0).max(1000).optional(),
});

export const generateQuestionsSchema = z.object({
  topic: z.string().trim().min(3, "Topik minimal 3 karakter"),
  count: z.number().int().min(1),
  difficulty: z.enum(["mudah", "sedang", "sulit", "campuran"]),
  numOptions: z.union([z.literal(4), z.literal(5)]),
  language: examLanguageSchema.optional().default("indonesia"),
  context: z.string().trim().max(8000).optional().default(""),
});

export const saveGeneratedQuestionsSchema = z.object({
  questions: z
    .array(
      z.object({
        text: z.string().trim().min(3),
        options: z.array(optionSchema).min(2).max(6),
        correct_option_id: z.string().min(1),
        explanation: z.string().trim().optional().default(""),
      }),
    )
    .min(1),
});

export const startAttemptSchema = z.object({
  student_name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  student_nim: z.string().trim().min(2, "NIM minimal 2 karakter"),
});

export const saveAnswerSchema = z.object({
  question_id: z.string().min(1),
  selected_option_id: z.string().min(1).nullable(),
});

export const manualScoreUpdateSchema = z.object({
  score: z
    .number()
    .min(0, "Nilai minimal 0")
    .max(100, "Nilai maksimal 100")
    .optional(),
  student_name: z.string().trim().min(2, "Nama minimal 2 karakter").optional(),
  student_nim: z.string().trim().min(2, "NIM minimal 2 karakter").optional(),
});
