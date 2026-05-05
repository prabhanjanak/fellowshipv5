import { db, usersTable } from "@workspace/db";
import bcrypt from "bcryptjs";

async function main() {
  console.log("Seeding admin users only...");
  
  await db.delete(usersTable);

  const hash = (p: string) => bcrypt.hash(p, 10);
  
  const sa = await hash("Saravanan@2026");
  const pa = await hash("Prabhanjan@2026");

  await db.insert(usersTable).values([
    { email: "saravanan@sankaraeye.com", passwordHash: sa, fullName: "Saravanan", role: "super_admin" },
    { email: "prabhanjan@sankaraeye.com", passwordHash: pa, fullName: "Prabhanjan", role: "program_admin" }
  ]);

  console.log("Seed complete");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
