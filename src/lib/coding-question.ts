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

function normalizeCodeForComparison(value: string) {
  return normalizeText(value)
    .replace(/\s*;\s*/g, ";")
    .replace(/\s*\{\s*/g, "{")
    .replace(/\s*}\s*/g, "}")
    .replace(/\s*\(\s*/g, "(")
    .replace(/\s*\)\s*/g, ")")
    .replace(/\s*\+\s*/g, "+")
    .replace(/\s*\=\s*/g, "=")
    .replace(/\s*,\s*/g, ",")
    .replace(/\s*:\s*/g, ":");
}

function normalizeHtmlLike(value: string) {
  return normalizeText(value)
    .replace(/<\s*([a-zA-Z0-9-]+)(\s*[^>]*)>/g, (_, tag, attrs = "") => {
      const normalizedAttrs = attrs
        .replace(
          /\s*([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g,
          ' $1="$2$3$4"',
        )
        .replace(/\s+/g, " ")
        .trim();
      return `<${tag}${normalizedAttrs ? ` ${normalizedAttrs}` : ""}>`;
    })
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .replace(/\s*([=<>])/g, "$1")
    .replace(/([=<>])\s*/g, "$1")
    .replace(/\s+>/g, ">")
    .replace(/<\s+/g, "<")
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
          const __result = (() => {
            ${input.code}
          })();

          if (__result && typeof __result.then === 'function') {
            return await __result;
          }

          return __result;
        })();
      `,
    );

    const result = await runner({
      log: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      error: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
      warn: (...args: unknown[]) => logs.push(args.map(String).join(" ")),
    });

    if (typeof result === "undefined") {
      return {
        ok: true,
        output: logs.join("\n"),
        error: "",
      };
    }

    if (typeof result === "string") {
      return {
        ok: true,
        output: result,
        error: "",
      };
    }

    if (Array.isArray(result) || typeof result === "object") {
      return {
        ok: true,
        output: JSON.stringify(result),
        error: "",
      };
    }

    return {
      ok: true,
      output: String(result),
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

function buildJavaScriptExecutionCode(
  starterCode: string,
  answerCode: string,
  testCaseInput: string,
) {
  const placeholderPatterns = [
    /__USER_CODE__/g,
    /__ANSWER_CODE__/g,
    /\{\{\s*USER_CODE\s*\}\}/g,
    /<<USER_CODE>>/g,
    /\[\[USER_CODE\]\]/g,
  ];

  const starter = (starterCode ?? "").trim();
  const answer = (answerCode ?? "").trim();
  const normalizedTestCaseInput = (testCaseInput ?? "").trim();
  const normalizedBody = normalizeCodeForComparison(normalizedTestCaseInput);
  const normalizedStarter = normalizeCodeForComparison(starter);
  const normalizedAnswer = normalizeCodeForComparison(answer);

  const hasPlaceholder = placeholderPatterns.some((pattern) =>
    pattern.test(normalizedTestCaseInput),
  );

  if (hasPlaceholder) {
    let interpolated = normalizedTestCaseInput;
    for (const pattern of placeholderPatterns) {
      interpolated = interpolated.replace(pattern, answerCode);
    }
    const nextBody = normalizeCodeForComparison(interpolated);
    return [
      starter && !nextBody.includes(normalizedStarter) ? starter : null,
      interpolated,
    ]
      .filter(Boolean)
      .join("\n\n");
  }

  const segments = [
    starter && !normalizedBody.includes(normalizedStarter) ? starter : null,
    answer && !normalizedBody.includes(normalizedAnswer) ? answer : null,
    normalizedTestCaseInput || null,
  ].filter(Boolean) as string[];

  return segments.join("\n\n");
}

export async function evaluateCodingAnswer(
  spec: CodingQuestionSpec,
  answerCode: string,
  correctSolutionCode?: string,
): Promise<CodeEvaluationResult> {
  if (spec.testCases.length === 0) {
    return {
      isCorrect: false,
      message:
        "Soal coding belum memiliki test case untuk pengecekan otomatis.",
    };
  }

  const starter = spec.starterCode ?? "";

  if (spec.language === "javascript") {
    const exactSolutionMatch =
      correctSolutionCode &&
      normalizeCodeForComparison(answerCode) ===
        normalizeCodeForComparison(correctSolutionCode);

    if (exactSolutionMatch) {
      return {
        isCorrect: true,
        message:
          "Jawaban benar. Struktur kode sesuai dengan solusi yang benar.",
      };
    }

    for (const testCase of spec.testCases) {
      const finalCode = buildJavaScriptExecutionCode(
        starter,
        answerCode,
        testCase.input,
      );
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

  if (spec.language === "html") {
    const answerNormalized = normalizeHtmlLike(answerCode);
    const expectedValues = spec.testCases.map((testCase) =>
      normalizeHtmlLike(testCase.expected_output),
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
      message: "Jawaban benar. Struktur HTML sesuai dengan kriteria soal.",
    };
  }

  const extractCssFragment = (value: string) => {
    const match = value.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
    const fragment = match ? match[1] : value;
    return normalizeCssLike(fragment);
  };

  const extractHtmlFragment = (value: string) => {
    const withoutStyle = value.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
    return normalizeHtmlLike(withoutStyle);
  };

  const answerCss = extractCssFragment(answerCode);
  const answerHtml = extractHtmlFragment(answerCode);

  const correctSolution = (correctSolutionCode ?? "").trim();
  if (correctSolution) {
    const correctCss = extractCssFragment(correctSolution);
    const correctHtml = extractHtmlFragment(correctSolution);
    const exactMatch = answerCss === correctCss && answerHtml === correctHtml;
    if (exactMatch) {
      return {
        isCorrect: true,
        message:
          "Jawaban benar. Struktur HTML/CSS sesuai dengan solusi yang benar.",
      };
    }
  }

  const passed = spec.testCases.every((testCase) => {
    const expectedCss = extractCssFragment(testCase.expected_output ?? "");
    const expectedHtml = extractHtmlFragment(testCase.expected_output ?? "");

    const cssMatches =
      expectedCss.length === 0 || answerCss.includes(expectedCss);
    const htmlMatches =
      expectedHtml.length === 0 || answerHtml.includes(expectedHtml);

    return cssMatches && htmlMatches;
  });

  if (!passed) {
    const expectedValues = spec.testCases.map((testCase) => ({
      css: extractCssFragment(testCase.expected_output ?? ""),
      html: extractHtmlFragment(testCase.expected_output ?? ""),
    }));

    return {
      isCorrect: false,
      message: `Jawaban salah: hasil HTML/CSS tidak sesuai dengan pola yang diharapkan.`,
      details: expectedValues.map((item) =>
        JSON.stringify({ css: item.css, html: item.html }),
      ),
    };
  }

  return {
    isCorrect: true,
    message: "Jawaban benar. Struktur HTML/CSS sesuai dengan kriteria soal.",
  };
}
