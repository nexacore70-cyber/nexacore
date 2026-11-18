import "dotenv/config";
import app from "./app.js";
import { prisma } from "./db.js";

const PORT = Number(process.env.PORT) || 4000;
const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`NexaCore API listening on port ${PORT}`);
});
let stopping = false;
async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  console.log(`Shutting down NexaCore API (${signal})...`);
  const timer = setTimeout(() => server.closeAllConnections?.(), 10000);
  timer.unref();
  server.close(async () => {
    clearTimeout(timer);
    try { await prisma.$disconnect(); }
    finally { process.exit(0); }
  });
}
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
