import { createVectorConnection } from "./src/db/connection.js";

const db = createVectorConnection();
const results = db
  .query(
    "SELECT entity_id, COUNT(*) as chunks, MAX(total_chunks) as total FROM brain_embeddings GROUP BY entity_id ORDER BY chunks DESC LIMIT 10",
  )
  .all();

console.log("Top 10 notes by chunk count:");
results.forEach((r: any) =>
  console.log(`  ${r.entity_id}: ${r.chunks} chunks (total: ${r.total})`),
);

db.close();
