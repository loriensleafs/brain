import { createVectorConnection } from "./src/db/connection.js";

const db = createVectorConnection();
const count = db
	.query("SELECT COUNT(DISTINCT entity_id) as total FROM brain_embeddings")
	.get() as any;
console.log("Total notes with embeddings:", count.total);
const chunkCount = db
	.query("SELECT COUNT(*) as total FROM brain_embeddings")
	.get() as any;
console.log("Total chunks:", chunkCount.total);
db.close();
