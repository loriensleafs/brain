export { createVectorConnection, verifySqliteVec } from "./connection";
export {
  createEmbeddingsTable,
  ensureEmbeddingTables,
  makeChunkId,
  parseChunkId,
  type ChunkedEmbedding,
} from "./schema";
export {
  storeChunkedEmbeddings,
  deleteChunkedEmbeddings,
  getChunkedEmbeddings,
  hasEmbeddings,
  countChunksForEntity,
  semanticSearchChunked,
  deduplicateByEntity,
  type ChunkEmbeddingInput,
  type SemanticSearchResult,
} from "./vectors";
