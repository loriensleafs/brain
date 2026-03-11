# Note and Entity Templates

## Brain Memory Note Templates

### Project Overview (High Importance)

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-001 Project Overview",
  "content": "---\ntitle: ANALYSIS-001 Project Overview\ntype: analysis\ntags: [overview, foundation]\n---\n\n# ANALYSIS-001 Project Overview\n\n## Observations\n\n- [fact] What the project does and key features #purpose\n- [fact] Target users and use cases #audience\n- [fact] Entry point and main command #entry\n\n## Relations\n\n- contains [[ANALYSIS-002 Technology Stack]]",
  "folder": "analysis"
})
```

### Architecture Pattern (High Importance)

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-002 Architecture Pattern",
  "content": "---\ntitle: ANALYSIS-002 Architecture Pattern\ntype: analysis\ntags: [architecture, foundation]\n---\n\n# ANALYSIS-002 Architecture Pattern\n\n## Observations\n\n- [fact] Layer structure and data flow #architecture\n- [fact] Key components and their roles #components\n- [decision] Why this architecture was chosen #rationale\n\n## Relations\n\n- part_of [[ANALYSIS-001 Project Overview]]",
  "folder": "analysis"
})
```

### Dependency Note (High Importance)

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-003 Dependencies",
  "content": "---\ntitle: ANALYSIS-003 Dependencies\ntype: analysis\ntags: [dependencies, tech-stack, frameworks]\n---\n\n# ANALYSIS-003 Dependencies\n\n## Observations\n\n- [fact] Language: [lang] [version] #language\n- [fact] Core frameworks: [list] #frameworks\n- [fact] Data/storage: [databases] #storage\n- [fact] Dev tools: [testing, linting] #dev-tools\n\n## Relations\n\n- relates_to [[ANALYSIS-001 Project Overview]]",
  "folder": "analysis"
})
```

### Component Note

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-NNN ComponentName",
  "content": "---\ntitle: ANALYSIS-NNN ComponentName\ntype: analysis\ntags: [component, service]\n---\n\n# ANALYSIS-NNN ComponentName\n\n## Observations\n\n- [fact] Description and location: path #location\n- [fact] Key responsibilities #responsibility\n- [fact] Reference count from Serena #importance\n\n## Relations\n\n- depends_on [[OtherComponent]]\n- part_of [[Architecture Layer]]",
  "folder": "analysis"
})
```

## Entity Tagging Strategy

- **Role tags**: `library`, `service`, `component`, `database`, `framework`, `tool`
- **Domain tags**: `auth`, `api`, `storage`, `ui`, `config`

## Relationship Types

| Type | Use When |
|------|----------|
| `uses` | Project/component uses library |
| `depends_on` | Component depends on another |
| `calls` | Service calls another service |
| `extends` | Class extends base class |
| `implements` | Class implements interface |
| `connects_to` | System connects to database/service |
| `part_of` | Component is part of a larger system |
| `contains` | Parent contains child |
| `relates_to` | General relationship |

## Symbol Index Note Template

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-NNN Symbol Index",
  "content": "---\ntitle: ANALYSIS-NNN Symbol Index\ntype: analysis\ntags: [symbol-index, reference, navigation]\n---\n\n# Symbol Index\n\n## Observations\n\n- [fact] Comprehensive index of classes, interfaces, and functions #scope\n\n## Classes\n\n| Symbol | Location | Description | Refs |\n|--------|----------|-------------|------|\n\n## Relations\n\n- part_of [[Project Architecture]]",
  "folder": "analysis"
})
```

## Architecture Reference Note Template

```
mcp__plugin____brain__write_note({
  "title": "ANALYSIS-NNN Architecture Reference",
  "content": "---\ntitle: ANALYSIS-NNN Architecture Reference\ntype: analysis\ntags: [architecture, reference]\n---\n\n# Architecture Reference\n\n## Observations\n\n- [fact] Complete architecture documentation #reference\n\n## Relations\n\n- contains [[Symbol Index]]\n- contains [[Component Notes]]",
  "folder": "analysis"
})
```
