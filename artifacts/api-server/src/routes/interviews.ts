import { Router } from "express";
import { and, eq } from "drizzle-orm";
import { db, doctorAssignmentsTable, interviewScoresTable, candidatesTable, unitsTable, usersTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";

const router: Router = Router();

// Doctor: get my assigned candidates
router.get("/interviews/assignments", requireAuth, requireRole("doctor"), async (req, res) => {
  const userId = req.user!.userId;
  const assigns = await db.select().from(doctorAssignmentsTable).where(eq(doctorAssignmentsTable.doctorId, userId));
  const candidates = await db.select().from(candidatesTable);
  const units = await db.select().from(unitsTable);
  const scores = await db.select().from(interviewScoresTable).where(eq(interviewScoresTable.doctorId, userId));
  res.json(assigns.map((a) => {
    const c = candidates.find((x) => x.id === a.candidateId);
    const unit = c?.unitId ? units.find((u) => u.id === c.unitId) : null;
    const sc = scores.find((s) => s.candidateId === a.candidateId);
    return {
      id: a.id,
      candidateId: a.candidateId,
      candidateName: c?.fullName ?? "",
      candidateCode: c?.candidateCode ?? "",
      unitName: unit?.name ?? null,
      scheduledAt: a.scheduledAt?.toISOString() ?? null,
      status: sc ? "completed" : a.status,
      existingScore: sc ? { id: sc.id, score: sc.score, remarks: sc.remarks, submittedAt: sc.submittedAt.toISOString() } : null,
    };
  }));
});

// Admin: get all interview scores with candidate/doctor names
router.get("/interviews/scores", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const scores = await db.select().from(interviewScoresTable);
  const candidates = await db.select().from(candidatesTable);
  const users = await db.select().from(usersTable);
  res.json(scores.map((s) => {
    const cand = candidates.find((c) => c.id === s.candidateId);
    const doc = users.find((u) => u.id === s.doctorId);
    return {
      id: s.id,
      candidateId: s.candidateId,
      candidateName: cand?.fullName ?? `#${s.candidateId}`,
      candidateCode: cand?.candidateCode ?? "",
      doctorId: s.doctorId,
      doctorName: doc?.fullName ?? `#${s.doctorId}`,
      score: s.score,
      remarks: s.remarks,
      submittedAt: s.submittedAt.toISOString(),
    };
  }));
});

// Admin: get all doctor assignments (for management panel)
router.get("/interviews/doctor-assignments", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const assigns = await db.select().from(doctorAssignmentsTable);
  const candidates = await db.select().from(candidatesTable);
  const users = await db.select().from(usersTable);
  const units = await db.select().from(unitsTable);
  const scores = await db.select().from(interviewScoresTable);

  const doctors = users.filter((u) => u.role === "doctor");

  res.json(doctors.map((d) => {
    const unit = d.unitId ? units.find((u) => u.id === d.unitId) : null;
    const myAssigns = assigns.filter((a) => a.doctorId === d.id);
    return {
      doctorId: d.id,
      doctorName: d.fullName,
      doctorEmail: d.email,
      unitId: d.unitId,
      unitName: unit?.name ?? null,
      assignments: myAssigns.map((a) => {
        const c = candidates.find((x) => x.id === a.candidateId);
        const sc = scores.find((s) => s.doctorId === d.id && s.candidateId === a.candidateId);
        return {
          id: a.id,
          candidateId: a.candidateId,
          candidateName: c?.fullName ?? "",
          candidateCode: c?.candidateCode ?? "",
          scheduledAt: a.scheduledAt?.toISOString() ?? null,
          status: sc ? "completed" : a.status,
          score: sc?.score ?? null,
        };
      }),
    };
  }));
});

// Admin: assign candidate to doctor
router.post("/interviews/assign", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const { doctorId, candidateId, scheduledAt } = req.body as { doctorId: number; candidateId: number; scheduledAt?: string };
  if (!doctorId || !candidateId) {
    res.status(400).json({ error: "doctorId and candidateId required" });
    return;
  }
  const [d] = await db.select().from(usersTable).where(eq(usersTable.id, doctorId));
  if (!d || d.role !== "doctor") { res.status(404).json({ error: "Doctor not found" }); return; }
  const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, candidateId));
  if (!c) { res.status(404).json({ error: "Candidate not found" }); return; }

  const existing = await db.select().from(doctorAssignmentsTable).where(
    and(eq(doctorAssignmentsTable.doctorId, doctorId), eq(doctorAssignmentsTable.candidateId, candidateId)),
  );

  let row;
  if (existing.length > 0) {
    [row] = await db.update(doctorAssignmentsTable)
      .set({ scheduledAt: scheduledAt ? new Date(scheduledAt) : null })
      .where(eq(doctorAssignmentsTable.id, existing[0]!.id))
      .returning();
  } else {
    [row] = await db.insert(doctorAssignmentsTable).values({
      doctorId, candidateId, status: "pending",
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
    }).returning();
  }
  if (!row) { res.status(500).json({ error: "Failed" }); return; }
  res.json({ id: row.id, doctorId, candidateId, status: row.status });
});

// Admin: remove candidate from doctor
router.delete("/interviews/assign/:assignmentId", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const id = Number(req.params["assignmentId"]);
  await db.delete(doctorAssignmentsTable).where(eq(doctorAssignmentsTable.id, id));
  res.json({ success: true });
});

// Doctor: submit score
router.post("/interviews/scores", requireAuth, requireRole("doctor"), async (req, res) => {
  const userId = req.user!.userId;
  const { candidateId, score, remarks } = req.body as { candidateId: number; score: number; remarks?: string };
  if (!candidateId || score == null) { res.status(400).json({ error: "Missing fields" }); return; }

  const existing = await db.select().from(interviewScoresTable).where(
    and(eq(interviewScoresTable.candidateId, candidateId), eq(interviewScoresTable.doctorId, userId)),
  );
  let row;
  if (existing.length > 0) {
    [row] = await db.update(interviewScoresTable).set({ score, remarks: remarks ?? null, submittedAt: new Date() })
      .where(eq(interviewScoresTable.id, existing[0]!.id)).returning();
  } else {
    [row] = await db.insert(interviewScoresTable).values({ candidateId, doctorId: userId, score, remarks: remarks ?? null }).returning();
  }
  if (!row) { res.status(500).json({ error: "Failed" }); return; }

  await db.update(candidatesTable).set({ status: "interview_completed" }).where(eq(candidatesTable.id, candidateId));
  await db.update(doctorAssignmentsTable).set({ status: "completed" })
    .where(and(eq(doctorAssignmentsTable.doctorId, userId), eq(doctorAssignmentsTable.candidateId, candidateId)));

  res.json({ id: row.id, candidateId: row.candidateId, doctorId: row.doctorId, score: row.score, remarks: row.remarks, submittedAt: row.submittedAt.toISOString() });
});

export default router;
