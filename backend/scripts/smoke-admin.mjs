// node scripts/smoke-admin.mjs -- run after deployment, no credentials required.
const base = (process.env.API_URL || "http://localhost:4000").replace(/\/$/, "");
let failed = false;
for (const [path, expected] of [["/api/health", 200], ["/api/admin/control/dashboard", 401], ["/api/admin/finance/overview", 401], ["/api/admin/auth/session", 401]]) {
  try {
    const response = await fetch(base + path, { redirect: "manual" });
    const ok = response.status === expected;
    console.log(`${ok ? "PASS" : "FAIL"} ${path}: HTTP ${response.status} (expected ${expected})`);
    if (!ok) failed = true;
  } catch (e) { console.log(`FAIL ${path}: ${e.message}`); failed = true; }
}
if (failed) process.exitCode = 1;
