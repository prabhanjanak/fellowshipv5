import { Router } from "express";
import { eq } from "drizzle-orm";
import {
  db,
  allocationsTable,
  candidatesTable,
  programsTable,
  specialitiesTable,
  unitsTable,
} from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";
import { computeScoresForProgram } from "../lib/scoring";
import { generateAllocationLetter } from "../lib/pdf";

const router: Router = Router();

async function listAllocations(programId?: number) {
  let allocs = await db.select().from(allocationsTable);
  if (programId) allocs = allocs.filter((a) => a.programId === programId);
  const candidates = await db.select().from(candidatesTable);
  const programs = await db.select().from(programsTable);
  const specs = await db.select().from(specialitiesTable);
  const units = await db.select().from(unitsTable);
  return allocs.map((a) => {
    const c = candidates.find((x) => x.id === a.candidateId);
    const p = programs.find((x) => x.id === a.programId);
    const s = a.specialityId ? specs.find((x) => x.id === a.specialityId) : null;
    const u = a.unitId ? units.find((x) => x.id === a.unitId) : null;
    return {
      id: a.id,
      candidateId: a.candidateId,
      candidateName: c?.fullName ?? "",
      candidateCode: c?.candidateCode ?? "",
      specialityId: a.specialityId,
      specialityName: s?.name ?? null,
      programName: p?.name ?? "",
      unitId: a.unitId,
      unitName: u?.name ?? null,
      status: a.status,
      rank: a.rank,
      allocatedAt: a.allocatedAt.toISOString(),
    };
  });
}

router.post("/allocations/run", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const { programId } = req.body as { programId: number };
  if (!programId) { res.status(400).json({ error: "programId required" }); return; }
  const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, programId));
  const seatsLeft = new Map<number, number>(specs.map((s) => [s.id, s.seats]));
  const ranked = await computeScoresForProgram(programId);

  // Wipe previous allocations for this program
  for (const a of await db.select().from(allocationsTable).where(eq(allocationsTable.programId, programId))) {
    await db.delete(allocationsTable).where(eq(allocationsTable.id, a.id));
  }

  let selected = 0;
  let waitlisted = 0;
  let rejected = 0;

  for (let i = 0; i < ranked.length; i++) {
    const r = ranked[i]!;
    let assignedSpecId: number | null = null;
    for (const specId of r.preferenceSpecIds) {
      const left = seatsLeft.get(specId);
      if (left != null && left > 0) {
        assignedSpecId = specId;
        seatsLeft.set(specId, left - 1);
        break;
      }
    }

    let status: string;
    if (assignedSpecId != null) {
      status = "SELECTED";
      selected++;
    } else {
      const anySeatsLeft = Array.from(seatsLeft.values()).some((v) => v > 0);
      if (anySeatsLeft || ranked.length <= specs.reduce((s, x) => s + x.seats, 0) * 2) {
        status = "WAITLISTED";
        waitlisted++;
      } else {
        status = "REJECTED";
        rejected++;
      }
    }

    const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, r.candidateId));
    await db.insert(allocationsTable).values({
      candidateId: r.candidateId,
      programId,
      specialityId: assignedSpecId,
      unitId: c?.unitId ?? null,
      status,
      rank: i + 1,
      totalScore: r.totalScore,
    });

    await db.update(candidatesTable).set({
      status: status === "SELECTED" ? "allocated" : status === "WAITLISTED" ? "waitlisted" : "rejected",
    }).where(eq(candidatesTable.id, r.candidateId));
  }

  res.json({ selected, waitlisted, rejected });
});

router.get("/allocations", requireAuth, async (req, res) => {
  const programId = req.query["programId"] ? Number(req.query["programId"]) : undefined;
  res.json(await listAllocations(programId));
});

router.get("/allocations/me", requireAuth, requireRole("student"), async (req, res) => {
  const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.userId, req.user!.userId));
  if (!c) { res.status(404).json({ error: "Candidate not found" }); return; }
  const [a] = await db.select().from(allocationsTable).where(eq(allocationsTable.candidateId, c.id));
  if (!a) { res.status(404).json({ error: "No allocation yet" }); return; }
  const all = await listAllocations();
  const out = all.find((x) => x.id === a.id);
  if (!out) { res.status(404).json({ error: "Not found" }); return; }
  res.json(out);
});

router.post("/allocations/:allocationId/override", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const id = Number(req.params["allocationId"]);
  const { specialityId, status } = req.body as { specialityId?: number | null; status: string };
  const [a] = await db.update(allocationsTable).set({
    specialityId: specialityId ?? null,
    status,
  }).where(eq(allocationsTable.id, id)).returning();
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  await db.update(candidatesTable).set({
    status: status === "SELECTED" ? "allocated" : status === "WAITLISTED" ? "waitlisted" : "rejected",
  }).where(eq(candidatesTable.id, a.candidateId));

  // If status changed away from SELECTED, promote highest-ranked WAITLISTED candidate (if any) for that program
  if (status !== "SELECTED" && a.specialityId == null) {
    const allocs = await db.select().from(allocationsTable).where(eq(allocationsTable.programId, a.programId));
    const wl = allocs.filter((x) => x.status === "WAITLISTED").sort((x, y) => (x.rank ?? 9999) - (y.rank ?? 9999))[0];
    const specs = await db.select().from(specialitiesTable).where(eq(specialitiesTable.programId, a.programId));
    if (wl) {
      // try to find an open speciality matching their preferences
      const filledBySpec = new Map<number, number>();
      for (const x of allocs) {
        if (x.status === "SELECTED" && x.specialityId != null) filledBySpec.set(x.specialityId, (filledBySpec.get(x.specialityId) ?? 0) + 1);
      }
      const openSpec = specs.find((s) => (filledBySpec.get(s.id) ?? 0) < s.seats);
      if (openSpec) {
        await db.update(allocationsTable).set({
          status: "SELECTED",
          specialityId: openSpec.id,
        }).where(eq(allocationsTable.id, wl.id));
        await db.update(candidatesTable).set({ status: "allocated" }).where(eq(candidatesTable.id, wl.candidateId));
      }
    }
  }

  const all = await listAllocations();
  const out = all.find((x) => x.id === id);
  res.json(out);
});

router.get("/allocations/:allocationId/letter", requireAuth, async (req, res) => {
  const id = Number(req.params["allocationId"]);
  const [a] = await db.select().from(allocationsTable).where(eq(allocationsTable.id, id));
  if (!a) { res.status(404).json({ error: "Not found" }); return; }
  const [c] = await db.select().from(candidatesTable).where(eq(candidatesTable.id, a.candidateId));
  const [p] = await db.select().from(programsTable).where(eq(programsTable.id, a.programId));
  const spec = a.specialityId ? (await db.select().from(specialitiesTable).where(eq(specialitiesTable.id, a.specialityId)))[0] : null;
  const unit = a.unitId ? (await db.select().from(unitsTable).where(eq(unitsTable.id, a.unitId)))[0] : null;
  if (!c || !p) { res.status(404).json({ error: "Missing data" }); return; }
  const data = {
    candidateName: c.fullName,
    candidateCode: c.candidateCode,
    programName: p.name,
    specialityName: spec?.name ?? "—",
    unitName: unit?.name ?? "—",
    unitCity: unit?.city ?? "—",
    allocatedAt: a.allocatedAt.toISOString(),
    status: a.status,
  };
  const pdfBase64 = await generateAllocationLetter(data);
  const pdfBuffer = Buffer.from(pdfBase64, "base64");
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="allocation-letter-${id}.pdf"`);
  res.send(pdfBuffer);
});

export default router;
