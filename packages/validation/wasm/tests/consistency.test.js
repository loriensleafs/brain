/**
 * Integration tests for consistency validation via WASM.
 * Uses Node.js built-in test runner (node --test).
 */

const { describe, it, before } = require('node:test');
const assert = require('node:assert');
const path = require('node:path');

// Load the validation module from dist
const validation = require('../dist/index.js');

describe('Consistency Validation via WASM', () => {
  before(async () => {
    // Initialize WASM before running tests
    await validation.initValidation();
  });

  describe('validateConsistency', () => {
    it('should validate a complete feature at checkpoint 1', () => {
      const epicContent = `# EPIC-001-auth

### Success Criteria

- [ ] Users can log in
`;
      const prdContent = `# PRD: Auth

References: EPIC-001

## Requirements

- [ ] Implement login
`;
      const tasksContent = `# Tasks

### Task 1
- [ ] Implement login
`;
      const planContent = `# Plan`;

      const result = validation.validateConsistency(
        epicContent,
        prdContent,
        tasksContent,
        planContent,
        'auth',
        1
      );

      assert.strictEqual(result.valid, true, `Expected valid=true, got: ${result.message}`);
      assert.strictEqual(result.checkpoint, 1);
      assert.strictEqual(result.feature, 'auth');
    });

    it('should fail when PRD has fewer requirements than Epic criteria', () => {
      const epicContent = `# EPIC-001-auth

### Success Criteria

- [ ] Criteria 1
- [ ] Criteria 2
- [ ] Criteria 3
`;
      const prdContent = `# PRD: Auth

References: EPIC-001

## Requirements

- [ ] Only one requirement
`;
      const tasksContent = `# Tasks

### Task 1
`;
      const planContent = `# Plan`;

      const result = validation.validateConsistency(
        epicContent,
        prdContent,
        tasksContent,
        planContent,
        'auth',
        1
      );

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.scopeAlignment.passed, false);

      // Check that the issue mentions fewer requirements
      const hasFewerReqIssue = result.scopeAlignment.issues.some(
        (issue) => issue.includes('fewer requirements')
      );
      assert.strictEqual(hasFewerReqIssue, true, 'Expected issue about fewer requirements');
    });

    it('should fail checkpoint 2 when P0 tasks are incomplete', () => {
      const epicContent = '';
      const prdContent = `# PRD: Auth

## Requirements

- [ ] Implement login
`;
      const tasksContent = `# Tasks

## P0 Tasks

- [ ] INCOMPLETE P0 TASK

## P1 Tasks

- [ ] Some P1 task
`;
      const planContent = '';

      const result = validation.validateConsistency(
        epicContent,
        prdContent,
        tasksContent,
        planContent,
        'auth',
        2
      );

      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.taskCompletion.passed, false);
      assert.ok(result.taskCompletion.p0Incomplete.length > 0);
    });

    it('should pass checkpoint 2 when P0 tasks are complete', () => {
      const epicContent = '';
      const prdContent = `# PRD: Auth

## Requirements

- [ ] Implement login
`;
      const tasksContent = `# Tasks

## P0 Tasks

- [x] Completed P0 task

## P1 Tasks

- [ ] Some P1 task
`;
      const planContent = '';

      const result = validation.validateConsistency(
        epicContent,
        prdContent,
        tasksContent,
        planContent,
        'auth',
        2
      );

      assert.strictEqual(result.taskCompletion.passed, true);
      assert.strictEqual(result.taskCompletion.p0Incomplete.length, 0);
    });
  });

  describe('validateNamingConvention', () => {
    it('should validate valid epic filename', () => {
      const result = validation.validateNamingConvention('EPIC-001-auth.md', 'epic');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.pattern, 'epic');
    });

    it('should reject invalid epic filename', () => {
      const result = validation.validateNamingConvention('epic-001-auth.md', 'epic');
      assert.strictEqual(result.valid, false);
    });

    it('should validate valid ADR filename', () => {
      const result = validation.validateNamingConvention('ADR-001-database.md', 'adr');
      assert.strictEqual(result.valid, true);
    });

    it('should validate valid session filename', () => {
      const result = validation.validateNamingConvention('2024-01-15-session-01.md', 'session');
      assert.strictEqual(result.valid, true);
    });

    it('should validate valid PRD filename', () => {
      const result = validation.validateNamingConvention('prd-user-auth.md', 'prd');
      assert.strictEqual(result.valid, true);
    });
  });

  describe('validateArtifactNaming', () => {
    it('should detect epic pattern', () => {
      const result = validation.validateArtifactNaming('EPIC-001-auth.md');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.patternType, 'epic');
    });

    it('should detect ADR pattern', () => {
      const result = validation.validateArtifactNaming('ADR-001-database.md');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.patternType, 'adr');
    });

    it('should detect session pattern', () => {
      const result = validation.validateArtifactNaming('2024-01-15-session-01.md');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.patternType, 'session');
    });

    it('should detect PRD pattern', () => {
      const result = validation.validateArtifactNaming('prd-auth.md');
      assert.strictEqual(result.valid, true);
      assert.strictEqual(result.patternType, 'prd');
    });

    it('should reject invalid pattern', () => {
      const result = validation.validateArtifactNaming('random-file.md');
      assert.strictEqual(result.valid, false);
      assert.strictEqual(result.patternType, '');
    });
  });
});
