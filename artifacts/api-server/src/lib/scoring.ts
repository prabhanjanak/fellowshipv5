import { db, candidatesTable, candidatePreferencesTable, examAttemptsTable, examsTable, interviewScoresTable, specialitiesTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export type CandidateScore = {
  candidateId: number;
  candidateCode: string;
  fullName: string;
  mcqScore: number;
  psychometricScore: number;
  interviewScore: number;
  totalScore: number;
  preferenceSpecIds: number[];
};

export async function computeScoresForProgram(programId: number): Promise<CandidateScore[]> {
  const candidates = await db.select().from(candidatesTable);
  const exams = await db.select().from(examsTable);
  const attempts = await db.select().from(examAttemptsTable);
  const interviews = await db.select().from(interviewScoresTable);
  const prefs = await db.select().from(candidatePreferencesTable);
  const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
  const programSpecIds = new Set(specs.map((s) => s.id));

  const result: CandidateScore[] = [];
  for (const c of candidates) {
    const candPrefs = prefs
      .filter((p) => p.candidateId === c.id && programSpecIds.has(p.specialityId))
      .sort((a, b) => a.preferenceOrder - b.preferenceOrder);
    if (candPrefs.length === 0) continue;
    const candAttempts = attempts.filter((a) => a.candidateId === c.id && a.submittedAt != null);
    const mcqs = candAttempts.filter((a) => exams.find((e) => e.id === a.examId)?.kind === "mcq");
    const psychos = candAttempts.filter((a) => exams.find((e) => e.id === a.examId)?.kind?.startsWith("psychometric"));
    const candInterviews = interviews.filter((i) => i.candidateId === c.id);
    const mcqScore = mcqs.length > 0 ? mcqs.reduce((s, a) => s + (a.score ?? 0), 0) / mcqs.length : 0;
    const psychoScore = psychos.length > 0 ? psychos.reduce((s, a) => s + (a.score ?? 0), 0) / psychos.length : 0;
    const intScore = candInterviews.length > 0 ? candInterviews.reduce((s, i) => s + i.score, 0) / candInterviews.length : 0;
    result.push({
      candidateId: c.id,
      candidateCode: c.candidateCode,
      fullName: c.fullName,
      mcqScore,
      psychometricScore: psychoScore,
      interviewScore: intScore,
      totalScore: mcqScore + psychoScore + intScore,
      preferenceSpecIds: candPrefs.map((p) => p.specialityId),
    });
  }
  result.sort((a, b) => b.totalScore - a.totalScore);
  return result;
}
