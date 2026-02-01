/**
 * Transformer module for converting parsed .agents/ files to basic-memory format
 *
 * Combines parsing, observation generation, and relation detection
 * to produce fully compliant basic-memory notes.
 */

import type {
  ParsedAgentFile,
  TransformedNote,
  Observation,
  Relation,
  AgentEntityType
} from './schema';
import { generateObservations } from './observations';
import { generateRelations, formatRelationsMarkdown } from './relations';
import { getTargetFolder } from './parser';

/**
 * Transform a parsed agent file to basic-memory format
 */
export function transformToBasicMemory(parsed: ParsedAgentFile): TransformedNote {
  // Generate observations and relations
  const observations = generateObservations(parsed);
  const relations = generateRelations(parsed);

  // Extract tags from content and metadata
  const tags = extractTags(parsed, observations);

  // Generate context section
  const context = generateContext(parsed);

  // Determine target folder
  const folder = getTargetFolder(parsed.entityType, parsed.relativePath);

  // Generate full markdown content
  const fullContent = generateFullContent({
    title: parsed.title,
    type: parsed.entityType,
    tags,
    context,
    observations,
    relations
  });

  return {
    folder,
    title: parsed.title,
    type: parsed.entityType,
    tags,
    observations,
    relations,
    context,
    fullContent
  };
}

/**
 * Extract tags from parsed file and observations
 */
function extractTags(
  parsed: ParsedAgentFile,
  observations: Observation[]
): string[] {
  const tags = new Set<string>();

  // Add entity type as tag
  tags.add(parsed.entityType);

  // Extract from frontmatter
  const fm = parsed.originalFrontmatter;
  if (Array.isArray(fm.tags)) {
    for (const tag of fm.tags) {
      if (typeof tag === 'string') {
        tags.add(normalizeTag(tag));
      }
    }
  }

  // Extract from category
  if (typeof fm.category === 'string') {
    tags.add(normalizeTag(fm.category));
  }

  // Extract from priority
  if (typeof fm.priority === 'string') {
    tags.add(fm.priority.toLowerCase());
  }

  // Extract from status
  if (typeof fm.status === 'string') {
    tags.add(normalizeTag(fm.status));
  }

  // Collect unique tags from observations
  for (const obs of observations) {
    for (const tag of obs.tags) {
      tags.add(normalizeTag(tag));
    }
  }

  // Extract from title patterns
  const titleTags = extractTitleTags(parsed.title, parsed.entityType);
  for (const tag of titleTags) {
    tags.add(tag);
  }

  // Limit to reasonable number
  return Array.from(tags).slice(0, 8);
}

/**
 * Normalize tag string
 */
function normalizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Extract tags from title patterns
 */
function extractTitleTags(title: string, entityType: AgentEntityType): string[] {
  const tags: string[] = [];

  // Session date extraction
  const dateMatch = title.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    tags.push(`${dateMatch[1]}-${dateMatch[2]}`); // year-month
  }

  // Session number
  const sessionMatch = title.match(/session[- ]?(\d+)/i);
  if (sessionMatch) {
    // Don't add session number as tag, too specific
  }

  // Topic extraction from title
  const topicPatterns: Record<string, string[]> = {
    security: ['security', 'auth', 'vulnerability', 'cwe', 'remediation'],
    testing: ['test', 'qa', 'validation', 'pester', 'jest'],
    ci: ['workflow', 'ci', 'pipeline', 'github-actions', 'build'],
    documentation: ['docs', 'documentation', 'readme', 'guide'],
    performance: ['performance', 'optimization', 'speed', 'benchmark'],
  };

  const lowerTitle = title.toLowerCase();
  for (const [tag, patterns] of Object.entries(topicPatterns)) {
    if (patterns.some(p => lowerTitle.includes(p))) {
      tags.push(tag);
    }
  }

  return tags;
}

/**
 * Generate context section from parsed content
 */
function generateContext(parsed: ParsedAgentFile): string {
  const sections = parsed.sections;
  const fm = parsed.originalFrontmatter;

  // Try various context sources
  const contextSources = [
    sections.get('Context'),
    sections.get('Overview'),
    sections.get('Objective'),
    sections.get('Background'),
    sections.get('Description'),
    sections.get('_intro'),
  ];

  for (const source of contextSources) {
    if (source && source.trim()) {
      // Extract first 2-3 sentences
      const sentences = source.match(/[^.!?]+[.!?]/g) || [];
      if (sentences.length > 0) {
        return sentences.slice(0, 3).join(' ').trim();
      }
      return source.slice(0, 300).trim();
    }
  }

  // Build context from metadata
  const contextParts: string[] = [];

  if (fm.status) {
    contextParts.push(`Status: ${fm.status}`);
  }
  if (fm.priority) {
    contextParts.push(`Priority: ${fm.priority}`);
  }
  if (fm.created) {
    contextParts.push(`Created: ${fm.created}`);
  }

  if (contextParts.length > 0) {
    return contextParts.join('. ') + '.';
  }

  // Fallback to entity description
  return `${parsed.entityType} document: ${parsed.title}`;
}

/**
 * Generate full markdown content in basic-memory format
 */
function generateFullContent(data: {
  title: string;
  type: AgentEntityType;
  tags: string[];
  context: string;
  observations: Observation[];
  relations: Relation[];
}): string {
  const lines: string[] = [];

  // Frontmatter
  lines.push('---');
  lines.push(`title: ${data.title}`);
  lines.push(`type: ${data.type}`);
  lines.push(`tags: [${data.tags.join(', ')}]`);
  lines.push(`permalink: ${generatePermalink(data.title, data.type)}`);
  lines.push('---');
  lines.push('');

  // Title
  lines.push(`# ${data.title}`);
  lines.push('');

  // Context section
  lines.push('## Context');
  lines.push('');
  lines.push(data.context);
  lines.push('');

  // Observations section
  lines.push('## Observations');
  lines.push('');
  for (const obs of data.observations) {
    const tagStr = obs.tags.length > 0 ? ` #${obs.tags.join(' #')}` : '';
    lines.push(`- [${obs.category}] ${obs.content}${tagStr}`);
  }
  lines.push('');

  // Relations section
  lines.push(formatRelationsMarkdown(data.relations));

  return lines.join('\n');
}

/**
 * Generate permalink from title and type
 */
function generatePermalink(title: string, type: AgentEntityType): string {
  // Get base folder
  const folderMap: Record<AgentEntityType, string> = {
    'session': 'sessions',
    'decision': 'decisions',
    'requirement': 'specs/requirements',
    'design': 'specs/design',
    'task': 'specs/tasks',
    'analysis': 'analysis',
    'feature': 'planning',
    'epic': 'roadmap',
    'critique': 'critique',
    'test-report': 'qa',
    'security': 'security',
    'retrospective': 'retrospective',
    'skill': 'skills',
    'note': 'notes'
  };

  const folder = folderMap[type] || 'notes';

  // Convert title to slug
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  return `${folder}/${slug}`;
}

/**
 * Format observations as markdown
 */
export function formatObservationsMarkdown(observations: Observation[]): string {
  if (observations.length === 0) {
    return '## Observations\n\n- [fact] Document created #metadata';
  }

  const lines = ['## Observations', ''];

  for (const obs of observations) {
    const tagStr = obs.tags.length > 0 ? ` #${obs.tags.join(' #')}` : '';
    lines.push(`- [${obs.category}] ${obs.content}${tagStr}`);
  }

  return lines.join('\n');
}

/**
 * Validate transformed note meets quality thresholds
 */
export function validateTransformation(note: TransformedNote): {
  valid: boolean;
  warnings: string[];
} {
  const warnings: string[] = [];

  if (note.observations.length < 3) {
    warnings.push(`Only ${note.observations.length} observations (minimum 3)`);
  }

  if (note.relations.length < 2) {
    warnings.push(`Only ${note.relations.length} relations (minimum 2)`);
  }

  if (!note.context || note.context.length < 10) {
    warnings.push('Context section is too short');
  }

  if (note.tags.length < 2) {
    warnings.push(`Only ${note.tags.length} tags (recommend 2+)`);
  }

  return {
    valid: warnings.length === 0,
    warnings
  };
}
