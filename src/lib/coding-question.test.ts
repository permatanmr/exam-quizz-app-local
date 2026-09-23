import test from "node:test";
import assert from "node:assert/strict";

import {
  compileAndRunJavaScript,
  evaluateCodingAnswer,
  type CodingQuestionSpec,
} from "./coding-question";

test("compileAndRunJavaScript runs valid JS and captures output", async () => {
  const result = await compileAndRunJavaScript({
    code: "console.log(2 + 3);",
    language: "javascript",
  });

  assert.equal(result.ok, true);
  assert.equal(result.output.trim(), "5");
  assert.equal(result.error, "");
});

test("evaluateCodingAnswer accepts function output matching expected result", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt: "Buat fungsi tambah(a, b) yang mengembalikan jumlahnya.",
    starterCode: "function tambah(a, b) {\n  return a + b;\n}\n",
    testCases: [
      { input: "console.log(tambah(2, 3));", expected_output: "5" },
      { input: "console.log(tambah(5, 7));", expected_output: "12" },
    ],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(
    spec,
    "function tambah(a, b) { return a + b; }",
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer ignores insignificant whitespace and newline differences", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt:
      "Buat fungsi formatName() yang menghasilkan teks dengan spasi yang konsisten.",
    starterCode: "",
    testCases: [
      {
        input: "console.log(formatName());",
        expected_output: "Hello World",
      },
    ],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(
    spec,
    'function formatName() { return "Hello\\nWorld"; }',
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts partial starter code with __USER_CODE__ placeholder", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt: "Buat fungsi tambah dua angka berdasarkan template yang diberikan.",
    starterCode: "function tambah(a, b) {\n  __USER_CODE__\n}\n",
    testCases: [
      {
        input:
          "function tambah(a, b) {\n  __USER_CODE__\n}\nconsole.log(tambah(3, 4));",
        expected_output: "7",
      },
      {
        input:
          "function tambah(a, b) {\n  __USER_CODE__\n}\nconsole.log(tambah(10, 5));",
        expected_output: "15",
      },
    ],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(spec, "return a + b;");

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts HTML+CSS CSS answers that render in preview", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "css",
    prompt: "Buat tombol dengan latar merah dan teks putih.",
    starterCode: "",
    testCases: [
      {
        input: "",
        expected_output:
          "<style>.btn { background: red; color: white; padding: 12px; }</style><button class='btn'>Klik</button>",
      },
    ],
    expectedOutputType: "css",
  };

  const result = await evaluateCodingAnswer(
    spec,
    "<style>\n  .btn {\n    background: red;\n    color: white;\n    padding: 12px;\n  }\n</style>\n<button class='btn'>Klik</button>",
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts a CSS answer identical to the saved solution", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "css",
    prompt: "Buat tombol dengan latar merah dan teks putih.",
    starterCode: "",
    testCases: [
      {
        input: "",
        expected_output: "<style>.btn{background:red;color:white;}</style>",
      },
    ],
    expectedOutputType: "css",
  };

  const solution =
    "<style>\n  .btn {\n    background: red;\n    color: white;\n  }\n</style>\n<button class='btn'>Klik</button>";

  const result = await evaluateCodingAnswer(spec, solution, solution);

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts equivalent CSS solution markup with different quote styles", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "css",
    prompt: "Buat tombol dengan latar merah dan teks putih.",
    starterCode: "",
    testCases: [
      {
        input: "",
        expected_output:
          "<style>.btn{background:red;color:white;padding:12px}</style><button class='btn'>Klik</button>",
      },
    ],
    expectedOutputType: "css",
  };

  const solution =
    '<style>.btn { background: red; color: white; padding: 12px; }</style><button class="btn">Klik</button>';
  const answer =
    "<style>.btn { background: red; color: white; padding: 12px; }</style><button class='btn'>Klik</button>";

  const result = await evaluateCodingAnswer(spec, answer, solution);

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer does not duplicate declarations when the test case already contains starter code", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt: "Hitung jumlah task yang aktif.",
    starterCode: "const tasks = ['a', 'b'];",
    testCases: [
      {
        input:
          "const tasks = ['a', 'b'];\nconst filtered = tasks.filter((task) => task.length > 0);\nconsole.log(filtered.length);",
        expected_output: "2",
      },
    ],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(
    spec,
    "const filtered = tasks.filter((task) => task.length > 0);",
    spec.starterCode,
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts direct array return from JavaScript function", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt: "Buat fungsi yang mengembalikan array tugas.",
    starterCode: "function getTasks() {",
    testCases: [
      {
        input:
          "function getTasks() {\n  return ['a', 'b', 'c'];\n}\nconsole.log(getTasks().join(','));",
        expected_output: "a,b,c",
      },
    ],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(
    spec,
    "return ['a', 'b', 'c'];",
    "",
  );

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts tasks-array solution without duplicate declaration", async () => {
  const starter = `let tasks = [];
function addTask(task) {
  tasks.push(task);
  return tasks;
}`;

  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt:
      "Buat fungsi addTask yang menambahkan task ke array dan mengembalikannya.",
    starterCode: starter,
    testCases: [
      {
        input: `${starter}\nconsole.log(JSON.stringify(addTask('A')));`,
        expected_output: '["A"]',
      },
    ],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(spec, starter, starter);

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer accepts exact saved JavaScript solution even without a manual function call", async () => {
  const solution = `let tasks = [];
function addTask(task) {
  tasks.push(task);
  return tasks;
}`;

  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt:
      "Buat fungsi addTask yang menambahkan task ke array dan mengembalikannya.",
    starterCode: solution,
    testCases: [{ input: "console.log('x');", expected_output: "x" }],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(spec, solution, solution);

  assert.equal(result.isCorrect, true);
  assert.equal(result.message.includes("benar"), true);
});

test("evaluateCodingAnswer rejects wrong output", async () => {
  const spec: CodingQuestionSpec = {
    type: "coding",
    language: "javascript",
    prompt: "Hitung keliling persegi.",
    starterCode: "",
    testCases: [{ input: "console.log(4 * 6);", expected_output: "24" }],
    expectedOutputType: "stdout",
  };

  const result = await evaluateCodingAnswer(spec, "console.log(10);");

  assert.equal(result.isCorrect, false);
  assert.equal(result.message.includes("salah"), true);
});
