import { Router } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable, unitsTable } from "@workspace/db";
import { signToken, hashPassword, comparePassword } from "../lib/auth";
import { requireAuth } from "../middleware/auth";

const router: Router = Router();

async function formatUser(user: typeof usersTable.$inferSelect) {
  let unitName: string | null = null;
  if (user.unitId) {
    const [unit] = await db.select().from(unitsTable).where(eq(unitsTable.id, user.unitId));
    unitName = unit?.name ?? null;
  }
  return {
    id: user.id,
    email: user.email,
    salutation: user.salutation ?? null,
    fullName: user.fullName,
    employeeId: user.employeeId ?? null,
    designation: (user as Record<string, unknown>)["designation"] as string | null ?? null,
    gender: (user as Record<string, unknown>)["gender"] as string | null ?? null,
    avatarSeed: (user as Record<string, unknown>)["avatarSeed"] as string | null ?? null,
    role: user.role,
    unitId: user.unitId,
    unitName,
    programId: user.programId,
    forcePasswordReset: user.forcePasswordReset,
  };
}

router.post("/auth/login", async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  if (!email || !password) {
    res.status(400).json({ error: "Email and password required" });
    return;
  }
  const lowered = email.toLowerCase().trim();
  if (!lowered.endsWith("@sankaraeye.com")) {
    res.status(403).json({ error: "Only @sankaraeye.com accounts are allowed" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, lowered));
  if (!user) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  if (!user.active) {
    res.status(403).json({ error: "Account is disabled" });
    return;
  }
  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }
  const token = signToken({ userId: user.id, email: user.email, role: user.role });
  res.json({ token, user: await formatUser(user) });
});

router.get("/auth/me", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(await formatUser(user));
});

router.post("/auth/change-password", requireAuth, async (req, res) => {
  const userId = req.user!.userId;
  const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };
  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: "Both current and new password required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "New password must be at least 8 characters" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const ok = await comparePassword(currentPassword, user.passwordHash);
  if (!ok) {
    res.status(401).json({ error: "Current password is incorrect" });
    return;
  }
  const passwordHash = await hashPassword(newPassword);
  const [updated] = await db.update(usersTable)
    .set({ passwordHash, forcePasswordReset: false })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(500).json({ error: "Failed to update password" });
    return;
  }
  res.json({ success: true, user: await formatUser(updated) });
});

// Admin: reset any user's password
router.post("/auth/admin-reset-password", requireAuth, async (req, res) => {
  const caller = req.user!;
  if (caller.role !== "super_admin") {
    res.status(403).json({ error: "Only super admins can reset passwords" });
    return;
  }
  const { userId, newPassword } = req.body as { userId: number; newPassword: string };
  if (!userId || !newPassword) {
    res.status(400).json({ error: "userId and newPassword required" });
    return;
  }
  if (newPassword.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }
  const passwordHash = await hashPassword(newPassword);
  const [updated] = await db.update(usersTable)
    .set({ passwordHash, forcePasswordReset: true })
    .where(eq(usersTable.id, userId))
    .returning();
  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json({ success: true });
});

export default router;
