import type { Question, QuestionRow } from "./types";

export function rowToQuestion(row: QuestionRow): Question {
  return {
    ...row,
    options: JSON.parse(row.options),
  };
}

export function questionToPublic(q: Question) {
  const { correct_option_id: _correct, explanation: _explanation, ...rest } = q;
  void _correct;
  void _explanation;
  return rest;
}
