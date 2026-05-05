import { pgTable, serial, timestamp, integer, text, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const allocationsTable = pgTable("allocations", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  programId: integer("program_id").notNull(),
  specialityId: integer("speciality_id"),
  unitId: integer("unit_id"),
  status: text("status").notNull().default("SELECTED"),
  rank: integer("rank"),
  totalScore: real("total_score"),
  allocatedAt: timestamp("allocated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAllocationSchema = createInsertSchema(allocationsTable).omit({ id: true, allocatedAt: true });
export type InsertAllocation = z.infer<typeof insertAllocationSchema>;
export type Allocation = typeof allocationsTable.$inferSelect;
