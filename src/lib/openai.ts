import OpenAI from "openai";

export type GeneratedQuestion = {
  text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  explanation: string;
};

export type QuestionLanguage = "indonesia" | "inggris" | "korea" | "jepang";

export type GenerateQuestionsInput = {
  topic: string;
  count: number;
  difficulty: "mudah" | "sedang" | "sulit" | "campuran";
  numOptions: 4 | 5;
  language?: QuestionLanguage;
  context?: string;
};

export function getLanguagePromptText(
  language: QuestionLanguage = "indonesia",
) {
  switch (language) {
    case "inggris":
      return "English";
    case "korea":
      return "한국어";
    case "jepang":
      return "日本語";
    case "indonesia":
    default:
      return "Bahasa Indonesia";
  }
}

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY belum diatur di file .env.local. Tambahkan API key OpenAI Anda untuk memakai fitur ini.",
    );
  }
  return new OpenAI({ apiKey });
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

export function buildQuestionSchema(
  input: Pick<GenerateQuestionsInput, "count" | "numOptions">,
) {
  const letters = OPTION_LETTERS.slice(0, input.numOptions);

  return {
    name: "generated_mcq_questions",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: input.count,
          maxItems: input.count,
          items: {
            type: "object",
            properties: {
              text: { type: "string", description: "Teks pertanyaan" },
              options: {
                type: "array",
                description: `Tepat ${input.numOptions} pilihan jawaban`,
                items: {
                  type: "object",
                  properties: {
                    id: { type: "string", enum: letters },
                    text: { type: "string" },
                  },
                  required: ["id", "text"],
                  additionalProperties: false,
                },
                minItems: input.numOptions,
                maxItems: input.numOptions,
              },
              correct_option_id: {
                type: "string",
                enum: letters,
                description: "id opsi yang benar",
              },
              explanation: {
                type: "string",
                description: "Penjelasan singkat kenapa jawaban tersebut benar",
              },
            },
            required: ["text", "options", "correct_option_id", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["questions"],
      additionalProperties: false,
    },
    strict: true,
  } as const;
}

export function validateGeneratedQuestionCount(
  questions: unknown,
  expectedCount: number,
): GeneratedQuestion[] {
  if (!Array.isArray(questions)) {
    throw new Error(
      `OpenAI mengembalikan format soal yang tidak valid. Harus ada tepat ${expectedCount} soal.`,
    );
  }

  if (questions.length !== expectedCount) {
    throw new Error(
      `OpenAI menghasilkan ${questions.length} soal, tetapi aplikasi membutuhkan tepat ${expectedCount} soal.`,
    );
  }

  return questions as GeneratedQuestion[];
}

export async function generateQuestions(
  input: GenerateQuestionsInput,
): Promise<GeneratedQuestion[]> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const letters = OPTION_LETTERS.slice(0, input.numOptions);
  const jsonSchema = buildQuestionSchema(input);

  const languageText = getLanguagePromptText(input.language ?? "indonesia");
  const difficultyText =
    input.difficulty === "campuran"
      ? "tingkat kesulitan bervariasi (campuran mudah, sedang, sulit)"
      : `tingkat kesulitan ${input.difficulty}`;

  const prompt = [
    `Buatkan tepat ${input.count} soal ujian pilihan ganda berbahasa ${languageText} tentang topik: "${input.topic}".`,
    `Setiap soal memiliki tepat ${input.numOptions} pilihan jawaban (${letters.join(", ")}) dengan hanya satu jawaban yang benar.`,
    `Gunakan ${difficultyText}. Hilangkan awalan jawaban A,B,C,D,E pada teks soal dan opsi jawaban.`,
    `Pastikan output berisi tepat ${input.count} soal dan tidak lebih atau kurang dari itu.`,
    input.context
      ? `Gunakan materi/konteks referensi berikut sebagai acuan utama pembuatan soal:\n"""\n${input.context}\n"""`
      : "",
    "Buat soal yang jelas, tidak ambigu, relevan secara akademis, dan hindari pengulangan antar soal.",
    "Sertakan penjelasan singkat (explanation) untuk setiap jawaban benar.",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content: `Anda adalah asisten yang membantu dosen membuat soal ujian pilihan ganda berkualitas tinggi dalam ${languageText}, mengikuti skema JSON yang diberikan secara ketat.`,
      },
      { role: "user", content: prompt },
    ],
    response_format: {
      type: "json_schema",
      json_schema: jsonSchema,
    },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) {
    throw new Error("OpenAI tidak mengembalikan hasil. Coba lagi.");
  }

  const parsed = JSON.parse(raw) as { questions?: unknown };
  return validateGeneratedQuestionCount(parsed.questions, input.count);
}
