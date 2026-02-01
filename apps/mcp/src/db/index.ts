export { createVectorConnection, verifySqliteVec } from "./connection";
export {
  type ChunkedEmbedding,
  createEmbeddingsTable,
  ensureEmbeddingTables,
  makeChunkId,
  parseChunkId,
} from "./schema";
export {
  type ChunkEmbeddingInput,
  countChunksForEntity,
  deduplicateByEntity,
  deleteChunkedEmbeddings,
  getChunkedEmbeddings,
  hasEmbeddings,
  type SemanticSearchResult,
  semanticSearchChunked,
  storeChunkedEmbeddings,
} from "./vectors";
