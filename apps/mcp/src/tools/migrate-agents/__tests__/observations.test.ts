/**
 * Tests for observation generator module
 */

import { describe, it, expect } from 'vitest';
import { generateObservations } from '../observations';
import type { ParsedAgentFile } from '../schema';

function createParsedFile(overrides: Partial<ParsedAgentFile> = {}): ParsedAgentFile {
  return {
    sourcePath: '/test/.agents/test.md',
    relativePath: 'test.md',
    originalFrontmatter: {},
    content: '',
    entityType: 'note',
    title: 'Test Document',
    sections: new Map(),
    ...overrides
  };
}

describe('generateObservations', () => {
  describe('session entity', () => {
    it('extracts objective observation', () => {
      const sections = new Map<string, string>();
      sections.set('Objective', 'Implement the authentication flow for user login.');

      const parsed = createParsedFile({
        entityType: 'session',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'fact' &&
        o.content.includes('authentication flow')
      )).toBe(true);
    });

    it('extracts from Key Findings', () => {
      const sections = new Map<string, string>();
      sections.set('Key Findings', `
- MCP configuration differs between environments
- VS Code expects .vscode/mcp.json
- Copilot CLI uses user-level config
`);

      const parsed = createParsedFile({
        entityType: 'session',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'insight' &&
        o.tags.includes('finding')
      )).toBe(true);
    });

    it('extracts branch information from frontmatter', () => {
      const parsed = createParsedFile({
        entityType: 'session',
        originalFrontmatter: { Branch: 'fix/auth-flow' },
        sections: new Map()
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.content.includes('fix/auth-flow') &&
        o.tags.includes('git')
      )).toBe(true);
    });
  });

  describe('decision entity', () => {
    it('extracts decision statement', () => {
      const sections = new Map<string, string>();
      sections.set('Decision', 'Use JWT tokens for authentication with 24-hour expiry.');

      const parsed = createParsedFile({
        entityType: 'decision',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'decision' &&
        o.content.includes('JWT tokens')
      )).toBe(true);
    });

    it('extracts context as problem', () => {
      const sections = new Map<string, string>();
      sections.set('Context', 'We need a stateless authentication mechanism for our API.');

      const parsed = createParsedFile({
        entityType: 'decision',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'problem' &&
        o.content.includes('stateless authentication')
      )).toBe(true);
    });

    it('extracts status from frontmatter', () => {
      const parsed = createParsedFile({
        entityType: 'decision',
        originalFrontmatter: { status: 'implemented' },
        sections: new Map()
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.content.includes('implemented') &&
        o.tags.includes('status')
      )).toBe(true);
    });
  });

  describe('requirement entity', () => {
    it('extracts requirement statement', () => {
      const sections = new Map<string, string>();
      sections.set('Requirement Statement', 'The system SHALL authenticate users via OAuth2.');

      const parsed = createParsedFile({
        entityType: 'requirement',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'requirement' &&
        o.content.includes('OAuth2')
      )).toBe(true);
    });

    it('extracts acceptance criteria', () => {
      const sections = new Map<string, string>();
      sections.set('Acceptance Criteria', `
- [ ] User can log in with email
- [x] Session persists across page refresh
- [ ] Logout clears all tokens
`);

      const parsed = createParsedFile({
        entityType: 'requirement',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.tags.includes('acceptance-criteria')
      )).toBe(true);
    });
  });

  describe('security entity', () => {
    it('extracts security findings as problems', () => {
      const sections = new Map<string, string>();
      sections.set('Findings', `
- HIGH: Command injection via unvalidated input
- MEDIUM: Missing rate limiting
`);

      const parsed = createParsedFile({
        entityType: 'security',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'problem' &&
        o.tags.includes('security')
      )).toBe(true);
    });

    it('extracts remediation as solution', () => {
      const sections = new Map<string, string>();
      sections.set('Remediation', 'Replace bash parsing with PowerShell using validated functions.');

      const parsed = createParsedFile({
        entityType: 'security',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.category === 'solution' &&
        o.content.includes('PowerShell')
      )).toBe(true);
    });
  });

  describe('quality thresholds', () => {
    it('ensures minimum observations', () => {
      const parsed = createParsedFile({
        entityType: 'note',
        title: 'Test Note With Title',
        content: 'Some introductory content for context.',
        sections: new Map()
      });

      const observations = generateObservations(parsed);

      // With title and content, should meet minimum of 3
      expect(observations.length).toBeGreaterThanOrEqual(3);
    });

    it('limits maximum observations', () => {
      const sections = new Map<string, string>();
      // Add many findings
      sections.set('Findings', Array(20).fill('- Finding item').join('\n'));

      const parsed = createParsedFile({
        entityType: 'security',
        sections
      });

      const observations = generateObservations(parsed);

      expect(observations.length).toBeLessThanOrEqual(10);
    });

    it('fills with metadata when content is sparse', () => {
      const parsed = createParsedFile({
        entityType: 'note',
        title: 'Sparse Document',
        sections: new Map()
      });

      const observations = generateObservations(parsed);

      expect(observations.some(o =>
        o.content.includes('Sparse Document')
      )).toBe(true);
    });
  });
});
