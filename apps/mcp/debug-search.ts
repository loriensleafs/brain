import { createVectorConnection } from "./src/db/connection.js";
import { generateEmbedding } from "./src/services/embedding/generateEmbedding.js";

const db = createVectorConnection();

// Check table contents
const count = db
  .query("SELECT COUNT(*) as count FROM brain_embeddings")
  .get() as any;
console.log(`Total embeddings in table: ${count.count}`);

// Get a sample embedding from the table
const sample = db
  .query(
    "SELECT chunk_id, entity_id, chunk_index, embedding FROM brain_embeddings LIMIT 1",
  )
  .get() as any;
if (sample) {
  console.log(`\nSample embedding:
   - chunk_id: ${sample.chunk_id}
   - entity_id: ${sample.entity_id}
   - chunk_index: ${sample.chunk_index}
   - embedding type: ${sample.embedding.constructor.name}
   - embedding length: ${sample.embedding.length}`);
}

// Generate a query embedding
const queryText = "test";
const queryEmbedding = await generateEmbedding(queryText);
if (queryEmbedding) {
  console.log(
    `\nQuery embedding generated: ${queryEmbedding.length} dimensions`,
  );

  // Try manual search
  const maxDistance = 1 - 0.01; // threshold 0.01
  console.log(`\nTrying manual search with maxDistance=${maxDistance}...`);

  try {
    const results = db
      .query(`
      SELECT
        chunk_id,
        entity_id,
        vec_distance_cosine(embedding, ?) as distance
      FROM brain_embeddings
      WHERE distance <= ?
      ORDER BY distance ASC
      LIMIT 10
    `)
      .all(new Float32Array(queryEmbedding), maxDistance);

    console.log(`Found ${results.length} results`);
    if (results.length > 0) {
      console.log("Results:", results);
    }
  } catch (e: any) {
    console.log(`Error: ${e.message}`);
  }
}

db.close();
