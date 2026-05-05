import { execSync } from "child_process";

try {
  console.log("Starting backend...");
  execSync("pnpm run start", { 
    env: { ...process.env, NODE_ENV: "development" }, 
    stdio: "inherit" 
  });
} catch (e) {
  process.exit(1);
}
