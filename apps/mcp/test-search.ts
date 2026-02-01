import { createVectorConnection } from "./src/db/connection.js";
import {
  deduplicateByEntity,
  semanticSearchChunked,
} from "./src/db/vectors.js";
import { generateEmbedding } from "./src/services/embedding/generateEmbedding.js";

const db = createVectorConnection();

// Generate query embedding
const query = "session protocol enforcement";
console.log(`Generating embedding for query: "${query}"`);
const queryEmbedding = await generateEmbedding(query);

if (!queryEmbedding) {
  console.log("Failed to generate query embedding");
  db.close();
  process.exit(1);
}

console.log(`Query embedding generated: ${queryEmbedding.length} dimensions`);

// Search
const limit = 10;
const threshold = 0.01;
console.log(`\nSearching with limit=${limit}, threshold=${threshold}...`);
const results = semanticSearchChunked(db, queryEmbedding, limit, threshold);
console.log(`Found ${results.length} raw results`);

if (results.length > 0) {
  console.log("\nRaw results:");
  results.forEach((r) => {
    console.log(
      `  - ${r.entityId} (chunk ${r.chunkIndex}/${r.totalChunks}) similarity=${r.similarity.toFixed(3)}`,
    );
  });

  const dedup = deduplicateByEntity(results);
  console.log(`\nDeduplicated to ${dedup.length} results`);
  dedup.forEach((r) => {
    console.log(`  - ${r.entityId} similarity=${r.similarity.toFixed(3)}`);
    console.log(`    Snippet: ${r.chunkText.substring(0, 100)}...`);
  });
} else {
  console.log("\nNo results found");
}

db.close();
