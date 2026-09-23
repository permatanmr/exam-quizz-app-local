"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  compileAndRunJavaScript,
  evaluateCodingAnswer,
} from "@/lib/coding-question";

type PublicQuestion = {
  id: string;
  question_type: "multiple_choice" | "coding";
  text: string;
  options: { id: string; text: string }[];
  order_index: number;
  selected_option_id: string | null;
  answer_text: string | null;
  coding_language?: string | null;
  coding_prompt?: string | null;
  coding_starter_code?: string | null;
  coding_solution_code?: string | null;
  coding_test_cases?: { input: string; expected_output: string }[];
};

type AttemptState = {
  id: string;
  student_name: string;
  status: "in_progress" | "submitted";
  started_at: string;
};

type ExamState = {
  title: string;
  duration_minutes: number;
  show_result_to_student: boolean;
};

function formatTime(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

function normalizeEscapedCode(value: string) {
  return value.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function highlightCodeSnippet(
  code: string,
  language: "javascript" | "html" | "css",
) {
  const normalized = normalizeEscapedCode(code || "");
  const escaped = escapeHtml(normalized);

  const escapedSequencePattern = /(\\[nrt\\'"`])/g;
  const keywordPattern =
    /\b(const|let|var|function|return|if|else|for|while|new|await|async|true|false|null|undefined|document|window|console|alert|class|extends|import|from|export|return)\b/g;
  const stringPattern =
    /("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)/g;
  const numberPattern = /(\b\d+\b)/g;
  const htmlTagPattern =
    /(<\/?[a-zA-Z0-9-]+(?:\s+[a-zA-Z-]+="[^"]*"|\s+[a-zA-Z-]+='[^']*'|\s+[a-zA-Z-]+=[^\s>]+|\s*)*>|<\/?[a-zA-Z0-9-]+\s*>)/g;
  const cssPattern =
    /(#[0-9a-fA-F]{3,6}|\.[a-zA-Z_-][\w-]*|\b[a-z-]+(?=\s*\{))/g;

  let highlighted = escaped;

  if (language === "html") {
    highlighted = highlighted.replace(
      htmlTagPattern,
      '<span class="text-cyan-400">$1</span>',
    );
  } else if (language === "css") {
    highlighted = highlighted
      .replace(cssPattern, '<span class="text-violet-300">$1</span>')
      .replace(
        /(\{.*?\}|\b[a-z-]+\s*:)/g,
        '<span class="text-sky-300">$1</span>',
      );
  } else {
    highlighted = highlighted
      .replace(
        stringPattern,
        (match) =>
          '<span class="text-emerald-300">' +
          match.replace(
            escapedSequencePattern,
            '<span class="text-amber-300">$1</span>',
          ) +
          "</span>",
      )
      .replace(keywordPattern, '<span class="text-violet-300">$1</span>')
      .replace(numberPattern, '<span class="text-amber-300">$1</span>')
      .replace(
        escapedSequencePattern,
        '<span class="text-amber-300">$1</span>',
      );
  }

  return highlighted.replace(/\n/g, "<br>");
}

function buildCssPreviewDocument(css: string, label: string) {
  const source =
    css.trim() ||
    ".demo{padding:20px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 12px 24px rgba(15,23,42,0.08);} body{padding:24px;background:linear-gradient(135deg,#eef2ff,#f8fafc);} h2{margin:0 0 12px;color:#111827;} p{margin:0 0 12px;color:#334155;} button{padding:10px 15px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:600;}";

  return `<!DOCTYPE html><html><head><style>
    html,body{margin:0;padding:0;font-family:system-ui;background:#f8fafc;color:#111827;}
    body{padding:24px;}
    .demo{padding:20px;border-radius:16px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 12px 24px rgba(15,23,42,0.08);max-width:480px;}
    h2{margin:0 0 12px;color:#111827;}
    p{margin:0 0 12px;color:#334155;}
    button{padding:10px 15px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:600;}
    ${source}
  </style></head><body><div class="demo"><h2>${label}</h2><p>Contoh elemen yang distyling oleh CSS.</p><button>Button Demo</button></div></body></html>`;
}

function buildCssRenderableDocument(source: string, label: string) {
  const code = (source ?? "").trim();
  if (!code) {
    return buildCssPreviewDocument("", label);
  }

  const hasHtmlStructure =
    /<\s*(html|body|div|section|button|p|h[1-6]|ul|ol|li|table|form|input|img|span|a|label)[\s>]/i.test(
      code,
    );
  if (!hasHtmlStructure) {
    return buildCssPreviewDocument(code, label);
  }

  const styleMatch = code.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  const cssBlock = styleMatch?.[1]?.trim() || "";
  const bodyMatch = code.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const htmlBody =
    bodyMatch?.[1]?.trim() ||
    code.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "").trim();

  return `<!DOCTYPE html><html><head><style>
    html,body{margin:0;padding:0;font-family:system-ui;background:#f8fafc;color:#111827;}
    body{padding:24px;}
    ${cssBlock || "body{padding:24px;} .demo{padding:20px;border-radius:16px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 12px 24px rgba(15,23,42,0.08);} h2{margin:0 0 12px;color:#111827;} p{margin:0 0 12px;color:#334155;} button{padding:10px 15px;border:0;border-radius:10px;background:#2563eb;color:#fff;font-weight:600;}"}
  </style></head><body>${htmlBody || `<div class="demo"><h2>${label}</h2><p>Contoh elemen yang distyling oleh CSS.</p><button>Button Demo</button></div>`}</body></html>`;
}

function buildLivePreviewDocument(
  language: "javascript" | "html" | "css",
  code: string,
) {
  const trimmed = code.trim();

  if (language === "html") {
    return `<!DOCTYPE html><html><head><style>body{font-family:system-ui;padding:16px;background:#f8fafc;color:#0f172a;}*{box-sizing:border-box;}h1{color:#0f172a;}button{padding:8px 12px;border:0;border-radius:8px;background:#2563eb;color:white;font-weight:600;}</style></head><body>${trimmed || "<h1>Preview</h1><p>HTML akan muncul di sini.</p>"}</body></html>`;
  }

  if (language === "css") {
    return buildCssRenderableDocument(trimmed, "Preview CSS");
  }

  const safeScript = (
    trimmed || "console.log('Kode JavaScript akan tampil di sini.');"
  ).replace(/<\/script>/gi, "<\\/script>");

  return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:20px;background:#f8fafc;color:#111827;">
    <div id="app" style="padding:20px;border-radius:12px;background:#fff;box-shadow:0 12px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
      <div id="output" style="white-space:pre-wrap;word-break:break-word;color:#0f172a;font-family:monospace;min-height:120px;"></div>
    </div>
    <script>
      const output = document.getElementById('output');
      const app = document.getElementById('app');
      const renderValue = (value) => {
        if (typeof value === 'string') {
          if (/<[a-z][\s\S]*>/i.test(value)) {
            app.innerHTML = value;
            output.textContent = '';
            return;
          }
          output.textContent = value;
          return;
        }
        if (value && typeof value === 'object') {
          output.textContent = JSON.stringify(value, null, 2);
          return;
        }
        output.textContent = typeof value === 'undefined' ? '' : String(value);
      };
      const consoleProxy = {
        log: (...args) => { const text = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '); output.textContent += text + '\n'; },
        warn: (...args) => { const text = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '); output.textContent += text + '\n'; },
        error: (...args) => { const text = 'Error: ' + args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '); output.textContent += text + '\n'; },
        info: (...args) => { const text = args.map((arg) => typeof arg === 'string' ? arg : JSON.stringify(arg)).join(' '); output.textContent += text + '\n'; },
      };
      window.console = consoleProxy;
      try {
        const runner = new Function('console', 'window', 'document', 'app', 'renderValue', ${JSON.stringify(safeScript)});
        const result = runner(consoleProxy, window, document, app, renderValue);
        if (typeof result !== 'undefined') {
          renderValue(result);
        }
      } catch (error) {
        output.textContent = 'Error: ' + (error && error.message ? error.message : String(error));
      }
    </script>
  </body></html>`;
}

function buildAnswerPreviewDocument(
  language: "javascript" | "html" | "css",
  expectedOutput: string,
) {
  const safe = (expectedOutput ?? "").trim();

  if (language === "html") {
    return `<!DOCTYPE html><html><head><style>html,body{margin:0;padding:0;background:#fff;color:#0f172a;font-family:system-ui;}*{box-sizing:border-box;}body{padding:12px;}</style></head><body>${safe || "<p></p>"}</body></html>`;
  }

  if (language === "css") {
    return buildCssRenderableDocument(
      safe ||
        "<style>.demo{padding:20px;border-radius:12px;background:#fff;border:1px solid #e2e8f0;box-shadow:0 12px 24px rgba(15,23,42,0.08);}</style><div class='demo'>Answer Preview</div>",
      "Answer Preview",
    );
  }

  return `<!DOCTYPE html><html><body style="font-family:monospace;white-space:pre-wrap;padding:16px;background:#f8fafc;color:#065f46;">${escapeHtml(safe || "-")}</body></html>`;
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

  const normalizedTestCaseInput = (testCaseInput ?? "").trim();
  const hasPlaceholder = placeholderPatterns.some((pattern) =>
    pattern.test(normalizedTestCaseInput),
  );

  if (hasPlaceholder) {
    let interpolated = normalizedTestCaseInput;
    for (const pattern of placeholderPatterns) {
      interpolated = interpolated.replace(pattern, answerCode);
    }
    return [starterCode, interpolated].filter(Boolean).join("\n\n");
  }

  return [starterCode, answerCode, normalizedTestCaseInput]
    .filter(Boolean)
    .join("\n\n");
}

function buildJavaScriptCheckedPreviewDocument(
  question: PublicQuestion,
  answerCode: string,
) {
  const language = (question.coding_language ?? "javascript") as
    | "javascript"
    | "html"
    | "css";
  if (language !== "javascript") {
    return buildLivePreviewDocument(language, answerCode);
  }

  const testCase = question.coding_test_cases?.[0];
  if (!testCase) {
    return buildLivePreviewDocument(language, answerCode);
  }

  const codeToRun = buildJavaScriptExecutionCode(
    question.coding_starter_code ?? "",
    answerCode,
    testCase.input,
  );

  const output = compileAndRunJavaScript({
    code: codeToRun,
    language: "javascript",
  }).then((result) => {
    const content = result.ok
      ? result.output || "(tanpa output)"
      : result.error;
    return `<!DOCTYPE html><html><body style="font-family:system-ui;padding:20px;background:#f8fafc;color:#111827;">
        <div style="padding:20px;border-radius:12px;background:#fff;box-shadow:0 12px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
          <pre style="margin:0;white-space:pre-wrap;word-break:break-word;color:${result.ok ? "#0f172a" : "#b91c1c"};font-family:monospace;">${escapeHtml(content)}</pre>
        </div>
      </body></html>`;
  });

  return output;
}

function openHtmlInNewWindow(html: string, title = "Code Live Preview") {
  const win = window.open(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
    "_blank",
    "noopener,noreferrer,width=1400,height=900,resizable=yes,scrollbars=yes",
  );
  if (!win) return;

  try {
    win.document.title = title;
  } catch {
    // Ignore cross-origin title write issues when using a new document source.
  }

  win.focus();
}

function ExternalLinkIcon() {
  return (
    <svg
      xmlns='http://www.w3.org/2000/svg'
      viewBox='0 0 24 24'
      fill='none'
      stroke='currentColor'
      strokeWidth={2}
      strokeLinecap='round'
      strokeLinejoin='round'
      className='h-3.5 w-3.5'>
      <path d='M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6' />
      <polyline points='15 3 21 3 21 9' />
      <line x1='10' y1='14' x2='21' y2='3' />
    </svg>
  );
}

export default function KerjakanClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get("attempt");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<AttemptState | null>(null);
  const [exam, setExam] = useState<ExamState | null>(null);
  const [questions, setQuestions] = useState<PublicQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string | null>>({});
  const [codingAnswers, setCodingAnswers] = useState<Record<string, string>>(
    {},
  );
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const [questionResults, setQuestionResults] = useState<
    Record<string, { isCorrect: boolean; message: string; checked: boolean }>
  >({});
  const [checkedPreviewDocuments, setCheckedPreviewDocuments] = useState<
    Record<string, string>
  >({});
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    if (!attemptId) {
      setError(
        "Sesi ujian tidak valid. Silakan mulai dari halaman kode ujian.",
      );
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`/api/public/attempts/${attemptId}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Sesi ujian tidak ditemukan");
        return;
      }
      if (data.attempt.status === "submitted") {
        router.replace(`/ujian/hasil?attempt=${attemptId}`);
        return;
      }
      setAttempt(data.attempt);
      setExam(data.exam);
      setQuestions(data.questions);
      const initialAnswers: Record<string, string | null> = {};
      for (const q of data.questions as PublicQuestion[]) {
        initialAnswers[q.id] = q.selected_option_id;
        if (q.question_type === "coding") {
          setCodingAnswers((prev) => ({
            ...prev,
            [q.id]: q.answer_text ?? q.coding_starter_code ?? "",
          }));
        }
      }
      setAnswers(initialAnswers);

      const startedAt = new Date(data.attempt.started_at).getTime();
      const deadline = startedAt + data.exam.duration_minutes * 60 * 1000;
      setRemainingSeconds(Math.max(0, (deadline - Date.now()) / 1000));
    } catch {
      setError("Terjadi kesalahan jaringan");
    } finally {
      setLoading(false);
    }
  }, [attemptId, router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch data saat mount
    load();
  }, [load]);

  const submit = useCallback(async () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    try {
      await fetch(`/api/public/attempts/${attemptId}/submit`, {
        method: "POST",
      });
      router.replace(`/ujian/hasil?attempt=${attemptId}`);
    } finally {
      setSubmitting(false);
    }
  }, [attemptId, router, submitting]);

  useEffect(() => {
    if (remainingSeconds === null) return;
    if (remainingSeconds <= 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- auto-submit saat waktu habis
      submit();
      return;
    }
    const interval = setInterval(() => {
      setRemainingSeconds((s) => (s !== null ? s - 1 : s));
    }, 1000);
    return () => clearInterval(interval);
  }, [remainingSeconds, submit]);

  async function selectAnswer(questionId: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    if (!attemptId) return;
    await fetch(`/api/public/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: questionId,
        selected_option_id: optionId,
      }),
    });
  }

  async function saveCodingAnswer(questionId: string, code: string) {
    setCodingAnswers((prev) => ({ ...prev, [questionId]: code }));
    setAnswers((prev) => ({
      ...prev,
      [questionId]: code.trim() ? "coding" : null,
    }));
    if (!attemptId) return;
    await fetch(`/api/public/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question_id: questionId, answer_text: code }),
    });
  }

  async function gradeCurrentQuestion(question: PublicQuestion) {
    if (question.question_type !== "coding") return;

    const code = codingAnswers[question.id] ?? "";
    if (!code.trim()) {
      setQuestionResults((prev) => ({
        ...prev,
        [question.id]: {
          isCorrect: false,
          message: "Jawaban masih kosong. Tulis kode terlebih dahulu.",
          checked: true,
        },
      }));
      return;
    }

    const evaluation = await evaluateCodingAnswer(
      {
        type: "coding",
        language: (question.coding_language ?? "javascript") as
          | "javascript"
          | "html"
          | "css",
        prompt: question.coding_prompt ?? "",
        starterCode: question.coding_starter_code ?? "",
        testCases: question.coding_test_cases ?? [],
        expectedOutputType: "stdout",
      },
      code,
      question.coding_solution_code ?? undefined,
    );

    setQuestionResults((prev) => ({
      ...prev,
      [question.id]: {
        isCorrect: evaluation.isCorrect,
        message: evaluation.message,
        checked: true,
      },
    }));

    if ((question.coding_language ?? "javascript") === "javascript") {
      const testCase = question.coding_test_cases?.[0];
      if (testCase) {
        const compiledCode = buildJavaScriptExecutionCode(
          question.coding_starter_code ?? "",
          code,
          testCase.input,
        );
        const result = await compileAndRunJavaScript({
          code: compiledCode,
          language: "javascript",
        });

        const previewDocument = `<!DOCTYPE html><html><body style="font-family:system-ui;padding:20px;background:#f8fafc;color:#111827;">
          <div style="padding:20px;border-radius:12px;background:#fff;box-shadow:0 12px 24px rgba(15,23,42,0.08); border:1px solid #e2e8f0;">
            <pre style="margin:0;white-space:pre-wrap;word-break:break-word;color:${result.ok ? "#0f172a" : "#b91c1c"};font-family:monospace;">${escapeHtml(
              result.ok ? result.output || "(tanpa output)" : result.error,
            )}</pre>
          </div>
        </body></html>`;

        setCheckedPreviewDocuments((prev) => ({
          ...prev,
          [question.id]: previewDocument,
        }));
      }
    }
  }

  async function submitSingleQuestion(question: PublicQuestion) {
    if (question.question_type !== "coding") return;

    const code = codingAnswers[question.id] ?? "";
    if (!attemptId) return;
    if (!code.trim()) {
      setQuestionResults((prev) => ({
        ...prev,
        [question.id]: {
          isCorrect: false,
          message: "Jawaban belum diisi.",
          checked: true,
        },
      }));
      return;
    }

    await fetch(`/api/public/attempts/${attemptId}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question_id: question.id,
        answer_text: code,
      }),
    });

    await gradeCurrentQuestion(question);
  }

  const answeredCount = useMemo(
    () =>
      Object.values(answers).filter((v) => v !== null && v !== undefined)
        .length,
    [answers],
  );

  const questionStatus = useMemo(() => {
    const next: Record<string, "answered" | "unanswered"> = {};
    for (const q of questions) {
      if (q.question_type === "coding") {
        const value = (codingAnswers[q.id] ?? "").trim();
        next[q.id] = value ? "answered" : "unanswered";
      } else {
        const value = answers[q.id];
        next[q.id] = value ? "answered" : "unanswered";
      }
    }
    return next;
  }, [answers, codingAnswers, questions]);

  function jumpToQuestion(questionId: string) {
    const index = questions.findIndex((q) => q.id === questionId);
    if (index >= 0) {
      setActiveQuestionIndex(index);
    }
    const el = questionRefs.current[questionId];
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (loading) {
    return (
      <div className='flex flex-1 items-center justify-center'>
        <p className='text-sm text-muted'>Memuat ujian...</p>
      </div>
    );
  }

  if (error || !attempt || !exam) {
    return (
      <div className='flex flex-1 items-center justify-center px-6'>
        <div className='card max-w-md p-8 text-center'>
          <p className='font-semibold text-danger'>
            {error ?? "Terjadi kesalahan"}
          </p>
        </div>
      </div>
    );
  }

  const isLowTime = (remainingSeconds ?? 0) < 300;
  const activeQuestion = questions[activeQuestionIndex];
  const activeCodingTestCase =
    activeQuestion?.question_type === "coding"
      ? activeQuestion.coding_test_cases?.[0]
      : undefined;
  const renderedHtmlPreview =
    activeCodingTestCase?.expected_output
      ?.replace(/\\n/g, "\n")
      .replace(/\\r\\n/g, "\n") ?? "";
  const activeCodingLanguage = (activeQuestion?.coding_language ??
    "javascript") as "javascript" | "html" | "css";
  const activeLivePreviewDocument = checkedPreviewDocuments[
    activeQuestion?.id ?? ""
  ]
    ? checkedPreviewDocuments[activeQuestion.id]
    : activeQuestion?.question_type === "coding" &&
        activeCodingLanguage === "css"
      ? buildCssRenderableDocument(
          codingAnswers[activeQuestion.id] ?? "",
          "Code Live Preview",
        )
      : buildLivePreviewDocument(
          activeCodingLanguage,
          codingAnswers[activeQuestion?.id ?? ""] ?? "",
        );
  const answerPreviewDocument =
    activeQuestion?.question_type === "coding"
      ? activeCodingLanguage === "css"
        ? buildCssRenderableDocument(
            activeQuestion.coding_solution_code ||
              activeCodingTestCase?.expected_output ||
              "",
            "Answer Preview",
          )
        : activeCodingTestCase
          ? buildAnswerPreviewDocument(
              activeCodingLanguage,
              activeCodingTestCase.expected_output || "",
            )
          : null
      : null;

  return (
    <div className='flex flex-1 flex-col'>
      <header className='sticky top-0 z-10 border-b border-border bg-surface'>
        <div className='mx-auto flex max-w-[1500px] items-center justify-between px-6 py-3'>
          <div>
            <p className='font-semibold'>{exam.title}</p>
            <p className='text-xs text-muted'>
              {attempt.student_name} · {answeredCount}/{questions.length}{" "}
              terjawab
            </p>
          </div>
          <div className='flex items-center gap-3'>
            <span
              className={`font-mono text-lg font-bold ${isLowTime ? "text-danger" : "text-foreground"}`}>
              {remainingSeconds !== null
                ? formatTime(remainingSeconds)
                : "--:--"}
            </span>
            <button
              onClick={() => {
                if (
                  confirm(
                    "Kumpulkan jawaban sekarang? Anda tidak bisa mengubah jawaban lagi.",
                  )
                ) {
                  submit();
                }
              }}
              disabled={submitting}
              className='btn btn-primary text-sm'>
              {submitting ? "Mengumpulkan..." : "Kumpulkan"}
            </button>
          </div>
        </div>
      </header>

      <main className='mx-auto w-full max-w-[1500px] flex-1 px-3 py-3'>
        <div className='grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]'>
          <div className='min-w-0'>
            {questions[activeQuestionIndex] && (
              <div
                id={questions[activeQuestionIndex].id}
                ref={(node) => {
                  questionRefs.current[questions[activeQuestionIndex].id] =
                    node;
                }}
                className={`card p-3 transition ${
                  questionStatus[questions[activeQuestionIndex].id] ===
                  "answered"
                    ? "border-green-200 bg-green-50/30"
                    : "border-border"
                }`}>
                {questions[activeQuestionIndex].question_type === "coding" ? (
                  <div className='mb-4 flex min-w-0 items-start justify-between gap-3'>
                    <div className='min-w-0'>
                      <p className='text-[10px] uppercase tracking-[0.2em] text-violet-600'>
                        Instruksi coding
                      </p>
                      <p className='mt-1 font-medium text-slate-900'>
                        {questions[activeQuestionIndex].coding_prompt ??
                          questions[activeQuestionIndex].text}
                      </p>
                    </div>
                    <span className='rounded-full border border-border bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-muted'>
                      {questionStatus[questions[activeQuestionIndex].id] ===
                      "answered"
                        ? "terjawab"
                        : "belum dijawab"}
                    </span>
                  </div>
                ) : (
                  <div className='mb-4 flex items-center justify-between gap-3'>
                    <p className='font-medium'>
                      {activeQuestionIndex + 1}.{" "}
                      {questions[activeQuestionIndex].text}
                    </p>
                    <span className='rounded-full border border-border bg-white px-2 py-1 text-[10px] uppercase tracking-wide text-muted'>
                      {questionStatus[questions[activeQuestionIndex].id] ===
                      "answered"
                        ? "terjawab"
                        : "belum dijawab"}
                    </span>
                  </div>
                )}

                {questions[activeQuestionIndex].question_type === "coding" ? (
                  <div className='mt-3 grid w-full gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.35fr)]'>
                    <div className='flex flex-col gap-2'>
                      <div className='flex h-[16rem] flex-col overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#0b1120] shadow-[0_0_0_1px_rgba(34,211,238,0.08),0_20px_50px_rgba(15,23,42,0.45)]'>
                        <div className='flex items-center justify-between border-b border-cyan-400/20 bg-slate-900/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200'>
                          <span>Code</span>
                          <span className='rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200'>
                            {questions[activeQuestionIndex].coding_language ??
                              "javascript"}
                          </span>
                        </div>
                        <textarea
                          value={
                            codingAnswers[questions[activeQuestionIndex].id] ??
                            ""
                          }
                          onChange={(e) =>
                            saveCodingAnswer(
                              questions[activeQuestionIndex].id,
                              e.target.value,
                            )
                          }
                          className='h-full w-full resize-y border-0 bg-transparent px-4 py-3 font-mono text-[13px] leading-6 text-slate-100 placeholder:text-slate-500 focus:outline-none selection:bg-cyan-500/30'
                          style={{
                            fontFamily:
                              '"SFMono-Regular", "Consolas", "Liberation Mono", monospace',
                            backgroundImage:
                              "linear-gradient(to bottom, rgba(15,23,42,0.2), rgba(15,23,42,0.2)), linear-gradient(to right, rgba(148,163,184,0.2) 0, rgba(148,163,184,0.2) 1px, transparent 1px)",
                            backgroundSize: "100% 24px, 32px 100%",
                            backgroundPosition: "left top, left top",
                          }}
                          placeholder={
                            questions[activeQuestionIndex]
                              .coding_starter_code ??
                            "Tulis jawaban coding Anda di sini..."
                          }
                        />
                      </div>
                    </div>

                    <div className='grid h-[16rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2'>
                      <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-red-200 bg-linear-to-br from-red-50 via-white to-rose-50 shadow-sm'>
                        <div className='flex items-center justify-between border-b border-red-100 bg-red-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700'>
                          <span>Code Live Preview</span>
                          <span className='rounded-full bg-red-600 px-2 py-0.5 text-[10px] text-white'>
                            AUTO
                          </span>
                        </div>
                        <iframe
                          title='Live preview'
                          srcDoc={activeLivePreviewDocument}
                          className='h-full w-full border-0 bg-white'
                          sandbox='allow-scripts allow-modals'
                        />
                      </div>

                      <div className='flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 via-white to-cyan-50 shadow-sm'>
                        <div className='flex items-center justify-between border-b border-emerald-100 bg-emerald-500/10 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700'>
                          <span>Answer</span>
                          <span className='rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] text-white'>
                            CORRECT
                          </span>
                        </div>
                        {activeCodingTestCase ? (
                          answerPreviewDocument &&
                          ["html", "css"].includes(
                            questions[activeQuestionIndex].coding_language ??
                              "javascript",
                          ) ? (
                            <iframe
                              title='Preview validasi'
                              srcDoc={answerPreviewDocument}
                              className='h-full w-full border-0 bg-white'
                              sandbox='allow-scripts allow-modals'
                            />
                          ) : (
                            <div className='h-full min-h-0 overflow-auto p-1.5 font-mono text-[11px] leading-5 text-emerald-700'>
                              {activeCodingTestCase.expected_output || "-"}
                            </div>
                          )
                        ) : (
                          <div className='flex h-full items-center justify-center p-3 text-[10px] text-slate-500'>
                            Belum ada validasi yang tersedia.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className='mt-3 flex flex-col gap-2'>
                    {questions[activeQuestionIndex].options.map((opt) => {
                      const selected =
                        answers[questions[activeQuestionIndex].id] === opt.id;
                      return (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-sm transition ${
                            selected
                              ? "border-primary bg-blue-50"
                              : "border-border hover:bg-gray-50"
                          }`}>
                          <input
                            type='radio'
                            name={questions[activeQuestionIndex].id}
                            checked={selected}
                            onChange={() =>
                              selectAnswer(
                                questions[activeQuestionIndex].id,
                                opt.id,
                              )
                            }
                            className='h-4 w-4'
                          />
                          <span>
                            <span className='font-semibold'>{opt.id}.</span>{" "}
                            {opt.text}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}

                {questions[activeQuestionIndex].question_type === "coding" &&
                  questionResults[questions[activeQuestionIndex].id] && (
                    <div
                      className={`mt-6 rounded-lg border px-3 py-2 text-sm ${
                        questionResults[questions[activeQuestionIndex].id]
                          .isCorrect
                          ? "border-green-200 bg-green-50 text-green-700"
                          : "border-red-200 bg-red-50 text-red-700"
                      }`}>
                      <strong>
                        {questionResults[questions[activeQuestionIndex].id]
                          .isCorrect
                          ? "Jawaban benar."
                          : "Jawaban salah."}
                      </strong>
                      <div className='mt-1 text-xs'>
                        {
                          questionResults[questions[activeQuestionIndex].id]
                            .message
                        }
                      </div>
                    </div>
                  )}

                <div className='mt-6 flex items-center justify-between gap-3'>
                  <button
                    type='button'
                    onClick={() =>
                      setActiveQuestionIndex((prev) => Math.max(0, prev - 1))
                    }
                    disabled={activeQuestionIndex === 0}
                    className='btn btn-secondary text-sm disabled:opacity-40'>
                    Sebelumnya
                  </button>
                  {questions[activeQuestionIndex].question_type ===
                    "coding" && (
                    <button
                      type='button'
                      onClick={() =>
                        gradeCurrentQuestion(questions[activeQuestionIndex])
                      }
                      className='btn btn-danger text-sm'>
                      Cek Jawaban
                    </button>
                  )}
                  <button
                    type='button'
                    onClick={() =>
                      setActiveQuestionIndex((prev) =>
                        Math.min(questions.length - 1, prev + 1),
                      )
                    }
                    disabled={activeQuestionIndex === questions.length - 1}
                    className='btn btn-primary text-sm disabled:opacity-40'>
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>

          <aside className='xl:sticky xl:top-24 xl:self-start'>
            <div className='rounded-xl border border-border bg-surface p-3 shadow-sm'>
              <div className='mb-2 flex items-center justify-between'>
                <p className='text-sm font-semibold'>Status soal</p>
                <p className='text-xs text-muted'>
                  {answeredCount}/{questions.length} terjawab
                </p>
              </div>
              <div className='flex flex-wrap gap-2'>
                {questions.map((q, index) => {
                  const isActive = index === activeQuestionIndex;
                  const isAnswered =
                    q.question_type === "coding"
                      ? (questionResults[q.id]?.isCorrect ?? false)
                      : Boolean(answers[q.id]);
                  const statusColor = isActive
                    ? "border-red-500 text-red-600 bg-red-50"
                    : isAnswered
                      ? "border-green-500 text-green-600 bg-green-50"
                      : "border-slate-300 text-slate-600 bg-white";

                  return (
                    <button
                      key={q.id}
                      type='button'
                      onClick={() => jumpToQuestion(q.id)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full border text-xs font-semibold transition ${statusColor}`}
                      title={
                        isAnswered
                          ? `Soal ${index + 1} sudah dijawab benar`
                          : `Soal ${index + 1} belum dijawab benar`
                      }>
                      {index + 1}
                    </button>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>

        <div className='mt-6 flex justify-center'>
          <button
            onClick={() => {
              if (
                confirm(
                  "Kumpulkan jawaban sekarang? Anda tidak bisa mengubah jawaban lagi.",
                )
              ) {
                submit();
              }
            }}
            disabled={submitting}
            className='btn btn-primary'>
            {submitting ? "Mengumpulkan..." : "Kumpulkan Ujian"}
          </button>
        </div>
      </main>
    </div>
  );
}
