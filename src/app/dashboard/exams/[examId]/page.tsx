import { notFound, redirect } from "next/navigation";
import { getCurrentDosen } from "@/lib/auth";
import { db } from "@/lib/db";
import type { ExamRow } from "@/lib/types";
import ExamManager from "./ExamManager";

type Props = { params: Promise<{ examId: string }> };

export default async function ExamDetailPage({ params }: Props) {
  const dosen = await getCurrentDosen();
  if (!dosen) redirect("/login");

  const { examId } = await params;
  const exam = db.prepare("SELECT * FROM exam WHERE id = ?").get(examId) as
    | ExamRow
    | undefined;

  if (!exam || exam.dosen_id !== dosen.id) {
    notFound();
  }

  return <ExamManager exam={exam} />;
}
