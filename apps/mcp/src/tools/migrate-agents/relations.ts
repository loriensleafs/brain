/**
 * Relation detector for transforming .agents/ content to basic-memory format
 *
 * Detects references to other entities and generates relations
 * in the wikilink format required by basic-memory.
 */

import type {
  ParsedAgentFile,
  Relation,
  RelationType,
  AgentEntityType
} from './schema';
import { QUALITY_THRESHOLDS } from './schema';

/**
 * Patterns for detecting entity references
 */
const ENTITY_PATTERNS = {
  // ADR references: ADR-001, ADR-015, etc.
  adr: /ADR-(\d+)(?:-[\w-]+)?/gi,
  // Requirement references: REQ-001, REQ-002
  requirement: /REQ-(\d+)(?:-[\w-]+)?/gi,
  // Design references: DESIGN-001
  design: /DESIGN-(\d+)(?:-[\w-]+)?/gi,
  // Task references: TASK-001, TASK-EPIC-001-03
  task: /TASK-(?:\w+-)?(\d+)(?:-\d+)?(?:-[\w-]+)?/gi,
  // Session references: Session 44, session-44, SESSION-2025-12-20-01
  session: /(?:Session[\s-]*)(\d+)|SESSION-(\d{4}-\d{2}-\d{2})-(\d+)/gi,
  // Epic references: EPIC-001
  epic: /EPIC-(\d+)(?:-[\w-]+)?/gi,
  // PR references: PR #123, #123, pr/123
  pr: /(?:PR\s*)?#(\d+)|pr\/(\d+)/gi,
  // Issue references: Issue #123
  issue: /Issue\s*#(\d+)/gi,
  // File references: .agents/sessions/, .github/workflows/
  filePath: /(?:\.agents\/|\.github\/|\.claude\/)([\w\/-]+\.(?:md|yml|ps1|ts))/gi,
  // Wikilinks already present: [[Target]]
  wikilink: /\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/g,
  // Explicit relations in frontmatter: related: [ADR-001, REQ-002]
  frontmatterRelated: /related:\s*\[([^\]]+)\]/gi,
};

/**
 * Generate relations from parsed agent file
 */
export function generateRelations(parsed: ParsedAgentFile): Relation[] {
  const relations: Relation[] = [];
  const seenTargets = new Set<string>();

  // Extract from existing wikilinks
  const wikilinks = extractWikilinks(parsed.content);
  for (const link of wikilinks) {
    if (!seenTargets.has(link)) {
      relations.push({
        type: 'relates_to',
        target: link
      });
      seenTargets.add(link);
    }
  }

  // Extract from frontmatter related field
  const fmRelations = extractFrontmatterRelations(parsed.originalFrontmatter);
  for (const rel of fmRelations) {
    if (!seenTargets.has(rel.target)) {
      relations.push(rel);
      seenTargets.add(rel.target);
    }
  }

  // Detect entity references in content
  const entityRefs = detectEntityReferences(parsed.content);
  for (const ref of entityRefs) {
    if (!seenTargets.has(ref.target)) {
      relations.push(ref);
      seenTargets.add(ref.target);
    }
  }

  // Add hierarchical relations based on entity type
  const hierarchical = detectHierarchicalRelations(parsed);
  for (const rel of hierarchical) {
    if (!seenTargets.has(rel.target)) {
      relations.push(rel);
      seenTargets.add(rel.target);
    }
  }

  // Ensure minimum relations
  if (relations.length < QUALITY_THRESHOLDS.minRelations) {
    const filler = generateFillerRelations(parsed, seenTargets);
    relations.push(...filler);
  }

  // Limit to maximum
  return relations.slice(0, QUALITY_THRESHOLDS.maxRelations);
}

/**
 * Extract existing wikilinks from content
 */
function extractWikilinks(content: string): string[] {
  const links: string[] = [];
  let match;

  while ((match = ENTITY_PATTERNS.wikilink.exec(content)) !== null) {
    links.push(match[1].trim());
  }

  // Reset regex
  ENTITY_PATTERNS.wikilink.lastIndex = 0;

  return links;
}

/**
 * Extract relations from frontmatter related field
 */
function extractFrontmatterRelations(frontmatter: Record<string, unknown>): Relation[] {
  const relations: Relation[] = [];

  // Handle related array
  if (Array.isArray(frontmatter.related)) {
    for (const item of frontmatter.related) {
      if (typeof item === 'string') {
        relations.push({
          type: inferRelationType(item),
          target: normalizeEntityName(item)
        });
      }
    }
  }

  // Handle related string
  if (typeof frontmatter.related === 'string') {
    const items = frontmatter.related.split(/[,;]\s*/);
    for (const item of items) {
      if (item.trim()) {
        relations.push({
          type: inferRelationType(item),
          target: normalizeEntityName(item.trim())
        });
      }
    }
  }

  // Handle implements, depends_on, etc. fields
  const relationFields: Array<[string, RelationType]> = [
    ['implements', 'implements'],
    ['depends_on', 'depends_on'],
    ['extends', 'extends'],
    ['part_of', 'part_of'],
    ['epic', 'part_of'],
    ['adr', 'implements'],
  ];

  for (const [field, relType] of relationFields) {
    const value = frontmatter[field];
    if (typeof value === 'string' && value && value !== 'null') {
      relations.push({
        type: relType,
        target: normalizeEntityName(value)
      });
    }
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === 'string' && item) {
          relations.push({
            type: relType,
            target: normalizeEntityName(item)
          });
        }
      }
    }
  }

  return relations;
}

/**
 * Detect entity references in content
 */
function detectEntityReferences(content: string): Relation[] {
  const relations: Relation[] = [];

  // ADR references
  let match;
  while ((match = ENTITY_PATTERNS.adr.exec(content)) !== null) {
    relations.push({
      type: 'relates_to',
      target: `ADR-${match[1].padStart(3, '0')}`
    });
  }
  ENTITY_PATTERNS.adr.lastIndex = 0;

  // Requirement references
  while ((match = ENTITY_PATTERNS.requirement.exec(content)) !== null) {
    relations.push({
      type: 'implements',
      target: `REQ-${match[1].padStart(3, '0')}`
    });
  }
  ENTITY_PATTERNS.requirement.lastIndex = 0;

  // Design references
  while ((match = ENTITY_PATTERNS.design.exec(content)) !== null) {
    relations.push({
      type: 'implements',
      target: `DESIGN-${match[1].padStart(3, '0')}`
    });
  }
  ENTITY_PATTERNS.design.lastIndex = 0;

  // Task references
  while ((match = ENTITY_PATTERNS.task.exec(content)) !== null) {
    relations.push({
      type: 'contains',
      target: `TASK-${match[1].padStart(3, '0')}`
    });
  }
  ENTITY_PATTERNS.task.lastIndex = 0;

  // Epic references
  while ((match = ENTITY_PATTERNS.epic.exec(content)) !== null) {
    relations.push({
      type: 'part_of',
      target: `EPIC-${match[1].padStart(3, '0')}`
    });
  }
  ENTITY_PATTERNS.epic.lastIndex = 0;

  return relations;
}

/**
 * Detect hierarchical relations based on entity type and structure
 */
function detectHierarchicalRelations(parsed: ParsedAgentFile): Relation[] {
  const relations: Relation[] = [];
  const fm = parsed.originalFrontmatter;

  // Requirements addressed (from design docs)
  const reqsAddressed = parsed.sections.get('Requirements Addressed');
  if (reqsAddressed) {
    const reqMatches = reqsAddressed.match(/REQ-\d+/gi) || [];
    for (const req of reqMatches.slice(0, 2)) {
      relations.push({
        type: 'implements',
        target: normalizeEntityName(req)
      });
    }
  }

  // Traceability section
  const traceability = parsed.sections.get('Traceability') ||
    parsed.sections.get('Related Artifacts');
  if (traceability) {
    const matches = traceability.match(/(?:ADR|REQ|DESIGN|TASK|EPIC)-\d+/gi) || [];
    for (const ref of matches.slice(0, 3)) {
      relations.push({
        type: inferRelationType(ref),
        target: normalizeEntityName(ref)
      });
    }
  }

  // Category/epic from frontmatter
  if (fm.category && typeof fm.category === 'string') {
    relations.push({
      type: 'part_of',
      target: fm.category
    });
  }

  return relations;
}

/**
 * Generate filler relations when too few detected
 */
function generateFillerRelations(
  parsed: ParsedAgentFile,
  existing: Set<string>
): Relation[] {
  const relations: Relation[] = [];
  const needed = QUALITY_THRESHOLDS.minRelations - existing.size;

  // Add parent folder as relation
  const folderName = parsed.relativePath.split('/')[0];
  if (folderName && !existing.has(folderName) && needed > 0) {
    relations.push({
      type: 'part_of',
      target: folderName,
      context: 'Container folder'
    });
  }

  // Add entity type collection relation
  const collectionName = getCollectionName(parsed.entityType);
  if (collectionName && !existing.has(collectionName) && relations.length < needed) {
    relations.push({
      type: 'part_of',
      target: collectionName,
      context: 'Document collection'
    });
  }

  return relations;
}

/**
 * Infer relation type from entity reference
 */
function inferRelationType(ref: string): RelationType {
  const upper = ref.toUpperCase();

  if (upper.startsWith('REQ-')) return 'implements';
  if (upper.startsWith('DESIGN-')) return 'implements';
  if (upper.startsWith('ADR-')) return 'depends_on';
  if (upper.startsWith('EPIC-')) return 'part_of';
  if (upper.startsWith('TASK-')) return 'contains';

  return 'relates_to';
}

/**
 * Normalize entity name for consistent referencing
 */
function normalizeEntityName(name: string): string {
  // Remove file extensions
  let normalized = name.replace(/\.md$/i, '');

  // Pad numbers in known patterns
  normalized = normalized.replace(
    /(ADR|REQ|DESIGN|TASK|EPIC)-(\d+)/gi,
    (_, prefix, num) => `${prefix.toUpperCase()}-${num.padStart(3, '0')}`
  );

  return normalized.trim();
}

/**
 * Get collection name for entity type
 */
function getCollectionName(entityType: AgentEntityType): string {
  const collections: Record<AgentEntityType, string> = {
    'session': 'Session Logs',
    'decision': 'Architecture Decisions',
    'requirement': 'Requirements',
    'design': 'Design Documents',
    'task': 'Tasks',
    'analysis': 'Analysis Documents',
    'feature': 'Feature Plans',
    'epic': 'Product Roadmap',
    'critique': 'Plan Reviews',
    'test-report': 'QA Reports',
    'security': 'Security Documents',
    'retrospective': 'Retrospectives',
    'skill': 'Skills',
    'note': 'Notes'
  };

  return collections[entityType] || 'Notes';
}

/**
 * Format relations as markdown for basic-memory
 */
export function formatRelationsMarkdown(relations: Relation[]): string {
  if (relations.length === 0) {
    return '## Relations\n\n- relates_to [[Documentation]]';
  }

  const lines = ['## Relations', ''];

  for (const rel of relations) {
    let line = `- ${rel.type} [[${rel.target}]]`;
    if (rel.context) {
      line += ` (${rel.context})`;
    }
    lines.push(line);
  }

  return lines.join('\n');
}
