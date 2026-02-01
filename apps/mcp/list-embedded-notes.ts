import { createVectorConnection } from "./src/db/connection.js";

const db = createVectorConnection();
const notes = db
	.query("SELECT DISTINCT entity_id FROM brain_embeddings LIMIT 5")
	.all();
console.log("Sample embedded notes:");
notes.forEach((n: any) => console.log("  -", n.entity_id));
db.close();
