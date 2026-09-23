import OpenAI from "openai";

export type GeneratedQuestion = {
  type?: "multiple_choice" | "coding";
  text: string;
  options?: { id: string; text: string }[];
  correct_option_id?: string;
  explanation?: string;
  language?: "javascript" | "html" | "css";
  prompt?: string;
  starter_code?: string;
  solution_code?: string;
  test_cases?: Array<{ input: string; expected_output: string }>;
  expected_output_type?: "stdout" | "html" | "css";
};

export type QuestionLanguage = "indonesia" | "inggris" | "korea" | "jepang";

export type CodingLanguage = "javascript" | "html" | "css";

export type GenerateQuestionsInput = {
  topic: string;
  count: number;
  difficulty: "mudah" | "sedang" | "sulit" | "campuran";
  numOptions: 4 | 5;
  language?: QuestionLanguage;
  context?: string;
  questionType?: "multiple_choice" | "coding";
  codingLanguage?: CodingLanguage;
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
  input: Pick<
    GenerateQuestionsInput,
    "count" | "numOptions" | "questionType" | "codingLanguage"
  >,
) {
  const letters = OPTION_LETTERS.slice(0, input.numOptions);
  const typeName =
    input.questionType === "coding"
      ? "generated_coding_questions"
      : "generated_mcq_questions";

  const codingProperties = {
    type: { type: "string", enum: ["coding"], description: "Tipe soal coding" },
    text: {
      type: "string",
      description: "Judul atau pertanyaan inti soal coding",
    },
    language: {
      type: "string",
      enum: [input.codingLanguage ?? "javascript", "html", "css"],
      description: "Bahasa pemrograman atau markup yang dipakai",
    },
    prompt: {
      type: "string",
      description: "Instruksi soal coding yang harus dikerjakan siswa",
    },
    starter_code: {
      type: "string",
      description:
        "Bagian kode awal yang sudah ada di soal, berupa potongan program yang sebagian bagian inti dibuang. Untuk semua jenis coding, starter_code tidak boleh berisi solusi lengkap; semua bagian inti yang harus diisi siswa harus dihapus dan, untuk JavaScript, diganti dengan placeholder seperti __USER_CODE__ di dalam test_cases[].input.",
    },
    solution_code: {
      type: "string",
      description:
        "Kode solusi lengkap yang benar untuk soal coding ini. Ini wajib berisi jawaban final yang lengkap dan siap dijalankan, serta harus sesuai dengan test_cases yang dibuat untuk bahasa coding yang dipilih (JavaScript, HTML, atau CSS). Untuk soal CSS, solusi harus mencakup markup HTML yang dibutuhkan agar hasil bisa dirender di dalam box Code Live Preview saat ujian; CSS saja tidak cukup jika preview memerlukan elemen HTML yang akan di-styling.",
    },
    test_cases: {
      type: "array",
      description:
        "Array test case yang harus siap di-compile dan di-assert. Untuk JavaScript, setiap item input harus berupa program lengkap yang bisa dijalankan, bukan potongan acak. Jika beberapa bagian harus diisi siswa, letakkan placeholder __USER_CODE__ pada posisi yang seharusnya diisi oleh jawaban siswa. Hasil yang diharapkan harus sama persis dengan output konsol setelah program dijalankan. Jangan menambah teks tambahan selain output aktual.",
      items: {
        type: "object",
        properties: {
          input: {
            type: "string",
            description:
              "Program JavaScript lengkap yang akan dijalankan untuk mengecek output. Untuk soal JavaScript, input ini harus bisa compile dengan kode starter dan jawaban siswa. Gunakan placeholder __USER_CODE__ bila siswa harus mengisi blok inti yang hilang.",
          },
          expected_output: {
            type: "string",
            description:
              "Output yang diharapkan persis dari hasil compilasi program, misalnya '5' atau 'Hello World'.",
          },
        },
        required: ["input", "expected_output"],
        additionalProperties: false,
      },
      minItems: 1,
    },
    expected_output_type: {
      type: "string",
      enum: ["stdout", "html", "css"],
      description: "Jenis output yang dinilai",
    },
    explanation: {
      type: "string",
      description: "Penjelasan singkat tentang solusi yang benar",
    },
  };

  const mcqProperties = {
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
  };

  const itemProperties =
    input.questionType === "coding" ? codingProperties : mcqProperties;
  const requiredFields =
    input.questionType === "coding"
      ? [
          "type",
          "text",
          "language",
          "prompt",
          "starter_code",
          "solution_code",
          "test_cases",
          "expected_output_type",
          "explanation",
        ]
      : ["text", "options", "correct_option_id", "explanation"];

  return {
    name: typeName,
    schema: {
      type: "object",
      properties: {
        questions: {
          type: "array",
          minItems: input.count,
          maxItems: input.count,
          items: {
            type: "object",
            properties: itemProperties,
            required: requiredFields,
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
  const questionType = input.questionType ?? "multiple_choice";
  const codingLanguage = input.codingLanguage ?? "javascript";
  const jsonSchema = buildQuestionSchema({
    count: input.count,
    numOptions: input.numOptions,
    questionType,
    codingLanguage,
  });

  const languageText = getLanguagePromptText(input.language ?? "indonesia");
  const difficultyText =
    input.difficulty === "campuran"
      ? "tingkat kesulitan bervariasi (campuran mudah, sedang, sulit)"
      : `tingkat kesulitan ${input.difficulty}`;

  const prompt = [
    questionType === "coding"
      ? `Buatkan tepat ${input.count} soal ujian coding berbahasa ${languageText} tentang topik: "${input.topic}".`
      : `Buatkan tepat ${input.count} soal ujian pilihan ganda berbahasa ${languageText} tentang topik: "${input.topic}".`,
    questionType === "coding"
      ? `Setiap soal harus menggunakan bahasa ${codingLanguage}. Tulis instruksi soal yang jelas, starter code yang relevan, dan minimal 1 test case yang valid.`
      : `Setiap soal memiliki tepat ${input.numOptions} pilihan jawaban (${letters.join(", ")}) dengan hanya satu jawaban yang benar.`,
    `Gunakan ${difficultyText}.`,
    `Pastikan output berisi tepat ${input.count} soal dan tidak lebih atau kurang dari itu.`,
    input.context
      ? `Gunakan materi/konteks referensi berikut sebagai acuan utama pembuatan soal:\n"""\n${input.context}\n"""`
      : "",
    questionType === "coding"
      ? "Format soal coding harus berisi field type, text, language, prompt, starter_code (opsional), solution_code, test_cases, expected_output_type, dan explanation."
      : "Format soal pilihan ganda harus berisi field text, options, correct_option_id, dan explanation.",
    "Buat soal yang jelas, tidak ambigu, relevan secara akademis, dan hindari pengulangan antar soal.",
    questionType === "coding"
      ? "Wajib sertakan field solution_code yang berisi jawaban lengkap yang benar untuk soal ini. solution_code harus dapat dijalankan dan konsisten dengan expected_output dan test_cases. Untuk soal CSS, solution_code HARUS mencakup HTML yang dibutuhkan agar dapat dirender di live preview; jangan kirim CSS saja tanpa markup HTML yang relevan."
      : "",
    questionType === "coding"
      ? "Untuk JavaScript, setiap test_cases[i].input HARUS berupa program lengkap yang siap dijalankan dan di-assert. Artinya, input tersebut harus berisi seluruh konteks program sehingga bisa compile dan menghasilkan output. Jika soal menuntut siswa menulis bagian inti logika, maka bagian yang hilang harus ditandai dengan placeholder __USER_CODE__ di dalam input, dan starter_code berperan sebagai bagian program yang sudah tersedia di awal atau di sekitar bagian yang dihilangkan. Hasil expected_output harus sama persis dengan output console program yang sudah selesai. Jawaban siswa benar hanya jika output program yang dikompilasi sama persis dengan expected_output."
      : "Sertakan penjelasan singkat (explanation) untuk setiap jawaban benar.",
    questionType === "coding"
      ? "Untuk JavaScript, starter_code bukanlah solusi lengkap. starter_code harus berupa potongan program yang sudah ada, tetapi inti solusinya dihilangkan sebagian. Test case input harus menunjukkan bagaimana potongan itu dipasang kembali menjadi program yang lengkap, dengan placeholder __USER_CODE__ pada bagian yang siswa harus isi. Jangan buat test case yang hanya berisi ekspresi acak; buat program yang benar-benar dapat di-compile dan dibandingkan outputnya."
      : "",
    questionType === "coding"
      ? "Gunakan expected_output_type sesuai jenis soal: stdout untuk console output, html untuk markup/html, css untuk deklarasi CSS. Khusus soal CSS, solution_code dan hasil preview harus mengandung HTML yang relevan bersama CSS-nya agar bisa dirender dengan benar di box preview pada halaman ujian."
      : "",
  ]
    .filter(Boolean)
    .join("\n");

  const completion = await client.chat.completions.create({
    model,
    messages: [
      {
        role: "system",
        content:
          questionType === "coding"
            ? `Anda adalah asisten yang membantu dosen membuat soal coding berkualitas tinggi dalam ${languageText}, mengikuti skema JSON yang diberikan secara ketat.`
            : `Anda adalah asisten yang membantu dosen membuat soal ujian pilihan ganda berkualitas tinggi dalam ${languageText}, mengikuti skema JSON yang diberikan secara ketat.`,
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
