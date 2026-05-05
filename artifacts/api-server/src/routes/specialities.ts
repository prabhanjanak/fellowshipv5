import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, specialitiesTable, allocationsTable } from "@workspace/db";
import { requireAuth, requireRole } from "../middleware/auth";

const router: Router = Router();

router.get("/specialities", requireAuth, async (req, res) => {
  const programIdRaw = req.query["programId"];
  const programId = programIdRaw ? Number(programIdRaw) : undefined;
  let rows = await db.select().from(specialitiesTable);
  if (programId) rows = rows.filter((r) => r.programId === programId);
  const allocs = await db.select().from(allocationsTable);
  const filledBySpec = new Map<number, number>();
  for (const a of allocs) {
    if (a.status === "SELECTED" && a.specialityId != null) {
      filledBySpec.set(a.specialityId, (filledBySpec.get(a.specialityId) ?? 0) + 1);
    }
  }
  res.json(rows.map((s) => ({
    id: s.id,
    programId: s.programId,
    name: s.name,
    code: s.code,
    seats: s.seats,
    filledSeats: filledBySpec.get(s.id) ?? 0,
  })));
});

router.post("/specialities", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const { programId, name, code, seats } = req.body as {
    programId: number;
    name: string;
    code: string;
    seats: number;
  };
  if (!programId || !name || !code || seats == null) {
    res.status(400).json({ error: "Missing fields" });
    return;
  }
  const [s] = await db.insert(specialitiesTable).values({ programId, name, code, seats }).returning();
  if (!s) { res.status(500).json({ error: "Failed" }); return; }
  res.json({ id: s.id, programId: s.programId, name: s.name, code: s.code, seats: s.seats, filledSeats: 0 });
});

router.patch("/specialities/:specialityId", requireAuth, requireRole("super_admin", "program_admin", "central_exam_coordinator"), async (req, res) => {
  const id = Number(req.params["specialityId"]);
  const { name, seats } = req.body as { name?: string; seats?: number };
  const update: Record<string, unknown> = {};
  if (name !== undefined) update["name"] = name;
  if (seats !== undefined) update["seats"] = seats;
  const [s] = await db.update(specialitiesTable).set(update).where(eq(specialitiesTable.id, id)).returning();
  if (!s) { res.status(404).json({ error: "Not found" }); return; }
  const allocs = await db.select().from(allocationsTable).where(eq(allocationsTable.specialityId, id));
  const filled = allocs.filter((a) => a.status === "SELECTED").length;
  res.json({ id: s.id, programId: s.programId, name: s.name, code: s.code, seats: s.seats, filledSeats: filled });
});

export default router;
