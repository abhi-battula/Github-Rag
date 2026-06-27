import dotenv from "dotenv";
import path from "path";

dotenv.config({
  path: path.resolve(__dirname, "../../packages/db/.env"),
});

import { client } from "./redis";
import { ingestion } from "./ingestion";
import { pg } from "db";

async function loop() {
  console.log("Worker started, polling queue...");

  while (true) {
    const event = await client.brPop('be-worker', 2);
    if (!event?.element) continue;

    const payload = JSON.parse(event.element) as Record<string, string>;
    const [repositoryId, repoUrl] = Object.entries(payload)[0]!;

    console.log(`Processing job: ${repositoryId} → ${repoUrl}`);

    try {
      await ingestion(repoUrl, repositoryId);
      await pg.repository.update({
        where: { id: repositoryId },
        data: { status: 'done' }
      });
      console.log(`Done: ${repositoryId}`);
    } catch (err) {
      console.error(`Failed: ${repositoryId}`, err);
      await pg.repository.update({
        where: { id: repositoryId },
        data: { status: 'failed' }
      }).catch(e => console.error("Failed to mark repo as failed:", e));
    }
  }
}

loop();
