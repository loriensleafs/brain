# Validation Tests

Test commands to verify encoding completeness.

---

## Validation

After completion, verify coverage:

### Test Brain Memory Search

```
mcp__plugin____brain__search({
  "query": "How do I add a new API endpoint?"
})
```

### Test Dependencies

```
mcp__plugin____brain__search({
  "query": "What dependencies does this project use?"
})
```

### Test Notes by Folder

```
mcp__plugin____brain__list_directory({
  "dir_name": "analysis"
})
```

### Test Note Relations

Read a component note and verify its relations section:

```
mcp__plugin____brain__read_note({
  "identifier": "ANALYSIS-004 AuthenticationService"
})
```

### Test Symbol Index

```
mcp__plugin____brain__search({
  "query": "symbol index navigation classes"
})
```

Should return the symbol index note with relations populated.

### Test Architecture Reference

```
mcp__plugin____brain__search({
  "query": "architecture reference layers patterns"
})
```

Should return the architecture reference note with links to component notes.

Test with architecture questions - encoded repos should answer accurately.

---

## Report Progress
