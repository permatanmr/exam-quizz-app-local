export type CodingLanguage = "javascript" | "html" | "css";
export type CodingQuestionType = "multiple_choice" | "coding";

export type CodingTestCase = {
  input: string;
  expected_output: string;
  expectedOutput?: string;
};

export type CodingQuestionSpec = {
  type: "coding";
  language: CodingLanguage;
  prompt: string;
  starterCode: string;
  testCases: CodingTestCase[];
  expectedOutputType: "stdout" | "html" | "css";
};

export type CodeEvaluationResult = {
  isCorrect: boolean;
  message: string;
  details?: string[];
};

function normalizeText(value?: string | null) {
  return (value ?? "")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/[\t ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHtmlLike(value: string) {
  return normalizeText(value)
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function normalizeCssLike(value: string) {
  return normalizeText(value)
    .replace(/\s*\{\s*/g, "{")
    .replace(/\s*;\s*/g, ";")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*}\s*/g, "}")
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function compileAndRunJavaScript(input: {
  code: string;
  language: CodingLanguage;
}): Promise<{ ok: boolean; output: string; error: string }> {
  if (input.language !== "javascript") {
    return {
      ok: false,
      output: "",
      error: "Evaluator hanya mendukung JavaScript untuk runtime otomatis.",
    };
  }

  const logs: string[] = [];

  try {
    const runner = new Function(
      "console",
      `
        return (async () => {
          ${input.code}
        })();
      `,
    );

    await runner({
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    });

    return {
      ok: true,
      output: logs.join("\n"),
      error: "",
    };
  } catch (error) {
    return {
      ok: false,
      output: logs.join("\n"),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function evaluateCodingAnswer(
  spec: CodingQuestionSpec,
  answerCode: string,
): Promise<CodeEvaluationResult> {
  if (spec.testCases.length === 0) {
    return {
      isCorrect: false,
      message:
        "Soal coding belum memiliki test case untuk pengecekan otomatis.",
    };
  }

  const starter = spec.starterCode ?? "";
  const fullCode = [starter, answerCode].filter(Boolean).join("\n");

  if (spec.language === "javascript") {
    for (const testCase of spec.testCases) {
      const finalCode = [fullCode, testCase.input].filter(Boolean).join("\n");
      const result = await compileAndRunJavaScript({
        code: finalCode,
        language: "javascript",
      });
      const actual = normalizeText(result.output);
      const expected = normalizeText(
        testCase.expected_output ?? testCase.expectedOutput,
      );

      if (!result.ok) {
        return {
          isCorrect: false,
          message: `Jawaban salah: kode gagal dijalankan. ${result.error}`,
          details: [result.error],
        };
      }

      if (actual !== expected) {
        return {
          isCorrect: false,
          message: `Jawaban salah: hasil yang didapat ${actual || "(kosong)"} tidak sesuai ${expected}.`,
          details: [`expected=${expected}`, `actual=${actual || "(kosong)"}`],
        };
      }
    }

    return {
      isCorrect: true,
      message: "Jawaban benar. Semua test case lolos.",
    };
  }

  const answerNormalized =
    spec.language === "html"
      ? normalizeHtmlLike(answerCode)
      : normalizeCssLike(answerCode);

  const expectedValues = spec.testCases.map((testCase) =>
    spec.language === "html"
      ? normalizeHtmlLike(testCase.expected_output)
      : normalizeCssLike(testCase.expected_output),
  );

  const passed = expectedValues.every((expected) =>
    answerNormalized.includes(expected),
  );

  if (!passed) {
    return {
      isCorrect: false,
      message: `Jawaban salah: hasil HTML/CSS tidak sesuai dengan pola yang diharapkan.`,
      details: expectedValues,
    };
  }

  return {
    isCorrect: true,
    message: "Jawaban benar. Struktur HTML/CSS sesuai dengan kriteria soal.",
  };
}
