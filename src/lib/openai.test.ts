import assert from "node:assert/strict";
import test from "node:test";

import {
  buildQuestionSchema,
  getLanguagePromptText,
  validateGeneratedQuestionCount,
} from "./openai.ts";

test("buildQuestionSchema restricts the total number of questions to the requested count", () => {
  const schema = buildQuestionSchema({ count: 3, numOptions: 4 });

  assert.equal(schema.schema.properties.questions.minItems, 3);
  assert.equal(schema.schema.properties.questions.maxItems, 3);
});

test("getLanguagePromptText returns the correct prompt language labels", () => {
  assert.equal(getLanguagePromptText("indonesia"), "Bahasa Indonesia");
  assert.equal(getLanguagePromptText("inggris"), "English");
  assert.equal(getLanguagePromptText("korea"), "한국어");
  assert.equal(getLanguagePromptText("jepang"), "日本語");
});

test("validateGeneratedQuestionCount rejects mismatched counts", () => {
  const questions = [
    {
      text: "Pertanyaan 1",
      options: [
        { id: "A", text: "Opsi A" },
        { id: "B", text: "Opsi B" },
        { id: "C", text: "Opsi C" },
        { id: "D", text: "Opsi D" },
      ],
      correct_option_id: "A",
      explanation: "Karena benar.",
    },
  ];

  assert.throws(
    () => validateGeneratedQuestionCount(questions, 2),
    /tepat 2 soal/i,
  );
});
