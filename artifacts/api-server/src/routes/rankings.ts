import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, specialitiesTable, candidatesTable, unitsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeScoresForProgram } from "../lib/scoring";

const router: Router = Router();

router.get(
  "/rankings",
  requireAuth,
  requireRole("super_admin", "program_admin", "central_exam_coordinator"),
  async (req, res) => {
    const programId = Number(req.query["programId"]);
    if (!programId) { res.status(400).json({ error: "programId required" }); return; }

    const scores = await computeScoresForProgram(programId);
    const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
    const candidates = await db.select().from(candidatesTable);
    const units = await db.select().from(unitsTable);

    res.json(scores.map((s, idx) => {
      const topSpecId = s.preferenceSpecIds[0];
      const topSpec = topSpecId ? specs.find((x) => x.id === topSpecId) : null;
      const cand = candidates.find((c) => c.id === s.candidateId);
      const unit = cand?.unitId ? units.find((u) => u.id === cand.unitId) : null;
      return {
        candidateId: s.candidateId,
        candidateCode: s.candidateCode,
        fullName: s.fullName,
        mcqScore: s.mcqScore,
        psychometricScore: s.psychometricScore,
        interviewScore: s.interviewScore,
        totalScore: s.totalScore,
        rank: idx + 1,
        topPreference: topSpec?.name ?? null,
        unitName: unit?.name ?? null,
        status: cand?.status ?? null,
      };
    }));
  }
);

export default router;
