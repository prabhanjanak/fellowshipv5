import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, examsTable, questionsTable, programsTable, candidatesTable, candidateExamAssignmentsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";

const router: Router = Router();

router.get("/exams", requireAuth, async (req, res) => {
  const programId = req.query["programId"] ? Number(req.query["programId"]) : undefined;
  const kind = req.query["kind"] as string | undefined;
  let exams = await db.select().from(examsTable);

  // Students only see exams that have been explicitly assigned to them
  if (req.user!.role === "student") {
    const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.userId, req.user!.userId));
    if (!c) { res.json([]); return; }
    const assignments = await db.select().from(candidateExamAssignmentsTable).where(eq(candidateExamAssignmentsTable.candidateId, c.id));
    const allowed = new Set(assignments.map((a) => a.examId));
    exams = exams.filter((e) => allowed.has(e.id));
  }

  if (programId) exams = exams.filter((e) => e.programId === programId);
  if (kind) exams = exams.filter((e) => e.kind === kind);
  const programs = await db.select().from(programsTable);
  const questions = await db.select().from(questionsTable);
  res.json(exams.map((e) => {
    const p = e.programId ? programs.find((x) => x.id === e.programId) : null;
    const qCount = questions.filter((q) => q.examId === e.id).length;
    return {
      id: e.id,
      title: e.title,
      kind: e.kind,
      programId: e.programId,
      programName: p?.name ?? null,
      durationMinutes: e.durationMinutes,
      totalQuestions: e.totalQuestions,
      questionCount: qCount,
      passingScore: e.passingScore,
      active: e.active,
      startsAt: e.startsAt?.toISOString() ?? null,
      endsAt: e.endsAt?.toISOString() ?? null,
    };
  }));
});

router.post("/exams", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const body = req.body as {
    title: string;
    kind: string;
    programId?: number | null;
    durationMinutes: number;
    totalQuestions: number;
    passingScore?: number;
    description?: string;
    startsAt?: string;
    endsAt?: string;
  };
  if (!body.title || !body.kind) { res.status(400).json({ error: "Missing fields" }); return; }
  const [e] = await db.insert(examsTable).values({
    title: body.title,
    kind: body.kind,
    programId: body.programId ?? null,
    durationMinutes: body.durationMinutes ?? 60,
    totalQuestions: body.totalQuestions ?? 20,
    passingScore: body.passingScore ?? null,
    description: body.description ?? null,
    startsAt: body.startsAt ? new Date(body.startsAt) : null,
    endsAt: body.endsAt ? new Date(body.endsAt) : null,
  }).returning();
  if (!e) { res.status(500).json({ error: "Failed" }); return; }
  res.json({
    id: e.id,
    title: e.title,
    kind: e.kind,
    programId: e.programId,
    programName: null,
    durationMinutes: e.durationMinutes,
    totalQuestions: e.totalQuestions,
    questionCount: 0,
    passingScore: e.passingScore,
    active: e.active,
    startsAt: e.startsAt?.toISOString() ?? null,
    endsAt: e.endsAt?.toISOString() ?? null,
  });
});

router.get("/exams/:examId", requireAuth, async (req, res) => {
  const id = Number(req.params["examId"]);
  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, id));
  if (!e) { res.status(404).json({ error: "Not found" }); return; }
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.examId, id));
  const programs = await db.select().from(programsTable);
  const p = e.programId ? programs.find((x) => x.id === e.programId) : null;
  res.json({
    id: e.id,
    title: e.title,
    kind: e.kind,
    programId: e.programId,
    programName: p?.name ?? null,
    durationMinutes: e.durationMinutes,
    totalQuestions: e.totalQuestions,
    questionCount: questions.length,
    passingScore: e.passingScore,
    active: e.active,
    startsAt: e.startsAt?.toISOString() ?? null,
    endsAt: e.endsAt?.toISOString() ?? null,
    description: e.description,
  });
});

export default router;
