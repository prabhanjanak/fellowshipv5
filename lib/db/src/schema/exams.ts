import { pgTable, text, serial, timestamp, integer, boolean, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const examsTable = pgTable("exams", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  kind: text("kind").notNull(),
  programId: integer("program_id"),
  durationMinutes: integer("duration_minutes").notNull().default(60),
  totalQuestions: integer("total_questions").notNull().default(20),
  passingScore: real("passing_score"),
  description: text("description"),
  active: boolean("active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const questionsTable = pgTable("questions", {
  id: serial("id").primaryKey(),
  examId: integer("exam_id").notNull(),
  text: text("text").notNull(),
  choices: text("choices").array().notNull(),
  correctIndex: integer("correct_index").notNull(),
  explanation: text("explanation"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const examAttemptsTable = pgTable("exam_attempts", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  examId: integer("exam_id").notNull(),
  score: real("score"),
  maxScore: real("max_score"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  submittedAt: timestamp("submitted_at", { withTimezone: true }),
});

export const examAnswersTable = pgTable("exam_answers", {
  id: serial("id").primaryKey(),
  attemptId: integer("attempt_id").notNull(),
  questionId: integer("question_id").notNull(),
  selectedIndex: integer("selected_index"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const candidateExamAssignmentsTable = pgTable("candidate_exam_assignments", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").notNull(),
  examId: integer("exam_id").notNull(),
  assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExamSchema = createInsertSchema(examsTable).omit({ id: true, createdAt: true });
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof examsTable.$inferSelect;
export type Question = typeof questionsTable.$inferSelect;
export type ExamAttempt = typeof examAttemptsTable.$inferSelect;
