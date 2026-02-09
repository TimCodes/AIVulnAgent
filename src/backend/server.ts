import express from "express";
import cors from "cors";
import { config } from "./config/env.js";
import { ensureSearchIndex } from "./services/azureSearch.js";
import routes from "./routes/index.js";

const app = express();

app.use(cors());
app.use(express.json());
app.use(routes);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

async function start() {
  // Ensure Azure Search index exists
  try {
    await ensureSearchIndex();
  } catch (err) {
    console.warn("[Startup] Azure Search index setup skipped:", err);
  }

  app.listen(config.server.port, () => {
    console.log(`\n🛡️  Vulnerability Remediation Agent`);
    console.log(`   Server running on http://localhost:${config.server.port}`);
    console.log(`   Environment: ${config.server.nodeEnv}\n`);
  });
}

start().catch(console.error);
