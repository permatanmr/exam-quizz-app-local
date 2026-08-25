import OpenAI from "openai";

export type GeneratedQuestion = {
  text: string;
  options: { id: string; text: string }[];
  correct_option_id: string;
  explanation: string;
};

export type GenerateQuestionsInput = {
  topic: string;
  count: number;
  difficulty: "mudah" | "sedang" | "sulit" | "campuran";
  numOptions: 4 | 5;
  context?: string;
};

function getClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY belum diatur di file .env.local. Tambahkan API key OpenAI Anda untuk memakai fitur ini."
    );
  }
  return new OpenAI({ apiKey });
}

const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

export async function generateQuestions(
  input: GenerateQuestionsInput
): Promise<GeneratedQuestion[]> {
  const client = getClient();
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const letters = OPTION_LETTERS.slice(0, input.numOptions);

  const optionSchemaProps: Record<string, unknown> = {};
  for (const l of letters) {
    optionSchemaProps[l] = { type: "string" };
  }

  const jsonSchema = {
    name: "generated_mcq_questions",
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
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

  const difficultyText =
    input.difficulty === "campuran"
      ? "tingkat kesulitan bervariasi (campuran mudah, sedang, sulit)"
      : `tingkat kesulitan ${input.difficulty}`;

  const prompt = [
    `Buatkan ${input.count} soal ujian pilihan ganda berbahasa Indonesia tentang topik: "${input.topic}".`,
    `Setiap soal memiliki tepat ${input.numOptions} pilihan jawaban (${letters.join(", ")}) dengan hanya satu jawaban yang benar.`,
    `Gunakan ${difficultyText}.`,
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
        content:
          "Anda adalah asisten yang membantu dosen membuat soal ujian pilihan ganda berkualitas tinggi dalam Bahasa Indonesia, mengikuti skema JSON yang diberikan secara ketat.",
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

  const parsed = JSON.parse(raw) as { questions: GeneratedQuestion[] };
  return parsed.questions;
}
