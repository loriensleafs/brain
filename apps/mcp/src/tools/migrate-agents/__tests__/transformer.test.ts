/**
 * Tests for transformer module
 */

import { describe, it, expect } from 'vitest';
import {
  transformToBasicMemory,
  validateTransformation,
  formatObservationsMarkdown
} from '../transformer';
import type { ParsedAgentFile } from '../schema';

function createParsedFile(overrides: Partial<ParsedAgentFile> = {}): ParsedAgentFile {
  return {
    sourcePath: '/test/.agents/sessions/2025-01-31-session-01.md',
    relativePath: 'sessions/2025-01-31-session-01.md',
    originalFrontmatter: {},
    content: '',
    entityType: 'session',
    title: 'Session 01 Test',
    sections: new Map(),
    ...overrides
  };
}

describe('transformToBasicMemory', () => {
  it('generates proper frontmatter', () => {
    const sections = new Map<string, string>();
    sections.set('Objective', 'Test the migration system.');
    sections.set('Key Findings', '- Finding 1\n- Finding 2\n- Finding 3');

    const parsed = createParsedFile({
      title: 'Session 01 Migration Test',
      originalFrontmatter: { status: 'complete', tags: ['migration', 'test'] },
      sections
    });

    const result = transformToBasicMemory(parsed);

    expect(result.fullContent).toContain('---');
    expect(result.fullContent).toContain('title: Session 01 Migration Test');
    expect(result.fullContent).toContain('type: session');
    expect(result.fullContent).toContain('tags:');
    expect(result.fullContent).toContain('permalink:');
  });

  it('generates context section', () => {
    const sections = new Map<string, string>();
    sections.set('Context', 'This session focused on testing the migration pipeline.');

    const parsed = createParsedFile({ sections });

    const result = transformToBasicMemory(parsed);

    expect(result.fullContent).toContain('## Context');
    expect(result.fullContent).toContain('migration pipeline');
    expect(result.context).toContain('migration pipeline');
  });

  it('generates observations section', () => {
    const sections = new Map<string, string>();
    sections.set('Key Findings', '- Found issue with parsing\n- Fixed the regex\n- Tests pass');

    const parsed = createParsedFile({
      entityType: 'session',
      sections
    });

    const result = transformToBasicMemory(parsed);

    expect(result.fullContent).toContain('## Observations');
    expect(result.fullContent).toMatch(/- \[\w+\]/); // Observation format
    expect(result.observations.length).toBeGreaterThanOrEqual(3);
  });

  it('generates relations section', () => {
    const parsed = createParsedFile({
      content: 'This relates to [[ADR-015]] and implements REQ-001.'
    });

    const result = transformToBasicMemory(parsed);

    expect(result.fullContent).toContain('## Relations');
    expect(result.fullContent).toContain('[[ADR-015]]');
    expect(result.relations.length).toBeGreaterThanOrEqual(2);
  });

  it('extracts tags from multiple sources', () => {
    const parsed = createParsedFile({
      title: 'Security Review Session',
      entityType: 'session',
      originalFrontmatter: { tags: ['security'], status: 'complete', priority: 'P0' }
    });

    const result = transformToBasicMemory(parsed);

    expect(result.tags).toContain('session');
    expect(result.tags).toContain('security');
    expect(result.tags.some(t => t.includes('complete') || t === 'p0')).toBe(true);
  });

  it('determines correct target folder', () => {
    const sessionParsed = createParsedFile({
      entityType: 'session',
      relativePath: 'sessions/test.md'
    });
    expect(transformToBasicMemory(sessionParsed).folder).toBe('sessions');

    const decisionParsed = createParsedFile({
      entityType: 'decision',
      relativePath: 'architecture/ADR-001.md'
    });
    expect(transformToBasicMemory(decisionParsed).folder).toBe('decisions');

    const reqParsed = createParsedFile({
      entityType: 'requirement',
      relativePath: 'specs/requirements/REQ-001.md'
    });
    expect(transformToBasicMemory(reqParsed).folder).toBe('specs/requirements');
  });

  it('transforms ADR correctly', () => {
    const sections = new Map<string, string>();
    sections.set('Context', 'We need to choose a database.');
    sections.set('Decision', 'Use PostgreSQL for relational data.');
    sections.set('Consequences', '- Better ACID compliance\n- More complex setup');

    const parsed = createParsedFile({
      title: 'ADR-015 Database Selection',
      entityType: 'decision',
      relativePath: 'architecture/ADR-015-database.md',
      originalFrontmatter: { status: 'accepted' },
      sections
    });

    const result = transformToBasicMemory(parsed);

    expect(result.type).toBe('decision');
    expect(result.folder).toBe('decisions');
    expect(result.observations.some(o => o.category === 'decision')).toBe(true);
    expect(result.observations.some(o => o.category === 'problem')).toBe(true);
  });

  it('transforms requirement correctly', () => {
    const sections = new Map<string, string>();
    sections.set('Requirement Statement', 'The system SHALL authenticate users.');
    sections.set('Acceptance Criteria', '- [x] Login works\n- [ ] Logout clears session');

    const parsed = createParsedFile({
      title: 'REQ-001 User Authentication',
      entityType: 'requirement',
      relativePath: 'specs/requirements/REQ-001.md',
      originalFrontmatter: { priority: 'P0' },
      sections
    });

    const result = transformToBasicMemory(parsed);

    expect(result.type).toBe('requirement');
    expect(result.observations.some(o => o.category === 'requirement')).toBe(true);
    expect(result.tags).toContain('p0');
  });
});

describe('validateTransformation', () => {
  it('passes valid transformation', () => {
    const note = {
      folder: 'sessions',
      title: 'Test Session',
      type: 'session' as const,
      tags: ['session', 'test'],
      observations: [
        { category: 'fact' as const, content: 'Fact 1', tags: [] },
        { category: 'fact' as const, content: 'Fact 2', tags: [] },
        { category: 'fact' as const, content: 'Fact 3', tags: [] }
      ],
      relations: [
        { type: 'relates_to' as const, target: 'A' },
        { type: 'relates_to' as const, target: 'B' }
      ],
      context: 'This is a test context with enough content.',
      fullContent: '...'
    };

    const result = validateTransformation(note);

    expect(result.valid).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it('warns on too few observations', () => {
    const note = {
      folder: 'sessions',
      title: 'Test',
      type: 'session' as const,
      tags: ['test'],
      observations: [
        { category: 'fact' as const, content: 'Only one', tags: [] }
      ],
      relations: [
        { type: 'relates_to' as const, target: 'A' },
        { type: 'relates_to' as const, target: 'B' }
      ],
      context: 'Valid context.',
      fullContent: '...'
    };

    const result = validateTransformation(note);

    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.includes('observations'))).toBe(true);
  });

  it('warns on too few relations', () => {
    const note = {
      folder: 'sessions',
      title: 'Test',
      type: 'session' as const,
      tags: ['test'],
      observations: [
        { category: 'fact' as const, content: 'Fact 1', tags: [] },
        { category: 'fact' as const, content: 'Fact 2', tags: [] },
        { category: 'fact' as const, content: 'Fact 3', tags: [] }
      ],
      relations: [
        { type: 'relates_to' as const, target: 'A' }
      ],
      context: 'Valid context.',
      fullContent: '...'
    };

    const result = validateTransformation(note);

    expect(result.valid).toBe(false);
    expect(result.warnings.some(w => w.includes('relations'))).toBe(true);
  });

  it('warns on short context', () => {
    const note = {
      folder: 'sessions',
      title: 'Test',
      type: 'session' as const,
      tags: ['test'],
      observations: [
        { category: 'fact' as const, content: 'Fact 1', tags: [] },
        { category: 'fact' as const, content: 'Fact 2', tags: [] },
        { category: 'fact' as const, content: 'Fact 3', tags: [] }
      ],
      relations: [
        { type: 'relates_to' as const, target: 'A' },
        { type: 'relates_to' as const, target: 'B' }
      ],
      context: 'Short',
      fullContent: '...'
    };

    const result = validateTransformation(note);

    expect(result.warnings.some(w => w.includes('Context'))).toBe(true);
  });
});

describe('formatObservationsMarkdown', () => {
  it('formats observations with categories and tags', () => {
    const observations = [
      { category: 'fact' as const, content: 'First fact', tags: ['tag1'] },
      { category: 'decision' as const, content: 'Made a decision', tags: ['tag2', 'tag3'] }
    ];

    const markdown = formatObservationsMarkdown(observations);

    expect(markdown).toContain('## Observations');
    expect(markdown).toContain('- [fact] First fact #tag1');
    expect(markdown).toContain('- [decision] Made a decision #tag2 #tag3');
  });

  it('handles empty observations', () => {
    const markdown = formatObservationsMarkdown([]);

    expect(markdown).toContain('## Observations');
    expect(markdown).toContain('[fact]');
  });

  it('handles observations without tags', () => {
    const observations = [
      { category: 'insight' as const, content: 'An insight', tags: [] }
    ];

    const markdown = formatObservationsMarkdown(observations);

    expect(markdown).toContain('- [insight] An insight');
    // The ## in heading contains #, but observation line should not have hashtag
    const observationLine = markdown.split('\n').find(l => l.includes('[insight]'));
    expect(observationLine).not.toContain('#insight');
    expect(observationLine).not.toContain('#tag');
  });
});
