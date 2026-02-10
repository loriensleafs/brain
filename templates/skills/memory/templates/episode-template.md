---
title: EPISODE-{{session_id}}
type: episode
tags: [episode, {{outcome}}, session-log]
session_id: {{session_id}}
outcome: {{outcome}}
task: {{task}}
date: {{date}}
metrics:
  agents_used: {{agents_used}}
  decisions_made: {{decisions_made}}
  errors_encountered: {{errors_encountered}}
  commits: {{commits}}
  files_changed: {{files_changed}}
  duration_minutes: {{duration_minutes}}
---

# Episode: {{session_id}}

**Task**: {{task}}
**Outcome**: {{outcome}}
**Date**: {{date}}

## Metrics

| Metric | Value |
|--------|-------|
| Duration (minutes) | {{duration_minutes}} |
| Decisions | {{decisions_made}} |
| Errors | {{errors_encountered}} |
| Commits | {{commits}} |
| Files Changed | {{files_changed}} |

## Observations

{{observations}}

## Decisions

{{decisions}}

## Events Timeline

{{events}}

## Lessons Learned

{{lessons}}

## Relations

- part_of [[sessions/{{session_id}}]]
{{relations}}
