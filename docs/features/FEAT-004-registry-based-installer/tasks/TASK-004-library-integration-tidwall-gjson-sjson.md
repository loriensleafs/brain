---
title: TASK-004 Library Integration tidwall-gjson-sjson
type: task
status: pending
feature-ref: FEAT-004
effort: M
permalink: features/feat-004-registry-based-installer/tasks/task-004-library-integration-tidwall-gjson-sjson
---

# TASK-004 Library Integration tidwall-gjson-sjson

## Description

Integrate `tidwall/gjson` and `tidwall/sjson` to replace manual `json.Unmarshal` + map type assertions for JSON reads and `jsonRemoveKeys` (~50 lines) for JSON writes. gjson provides path-based reads without full unmarshal. sjson provides path-based set/delete on raw `[]byte` preserving formatting and key order. Both libraries are commonly used together.

## Definition of Done

- [ ] [requirement] `tidwall/gjson` added to `go.mod` #acceptance
- [ ] [requirement] `tidwall/sjson` added to `go.mod` #acceptance
- [ ] [requirement] `jsonRemoveKeys` function replaced with `sjson.DeleteBytes` calls #acceptance
- [ ] [requirement] JSON key existence checks replaced with `gjson.Get(json, "path").Exists()` #acceptance
- [ ] [requirement] `registerMarketplace` map manipulation replaced with sjson operations #acceptance
- [ ] [requirement] Old json manipulation functions removed #acceptance
- [ ] [requirement] Tests verify path-based reads and writes on sample JSON #acceptance
- [ ] [requirement] Tests verify formatting preservation after sjson operations #acceptance

## Observations

- [fact] Status: PENDING #status
- [fact] Effort: M #effort
- [task] Two libraries integrated together; gjson for reads, sjson for writes #pair
- [fact] tidwall/gjson: 15,400 stars, 9,873 importers, MIT license #provenance
- [fact] tidwall/sjson: 2,700 stars, 3,100+ importers, MIT license #provenance
- [technique] gjson is 26x faster than map-based approach for targeted reads #performance
- [constraint] sjson preserves key order and formatting, which is important for user-facing config files #ux

## Effort Summary

| Dimension | Value |
|---|---|
| T-Shirt Size | M |
| Human Effort | 3 hours |
| AI-Dominant Effort | 0.75 hours |
| AI Tier | Tier 2 (AI-Accelerated) |
| AI Multiplier | 2x |
| AI Effort | 1.5 hours |
| Rationale | Two library integrations with multiple replacement sites; API mapping is clear but replacement scope requires careful auditing |

## Relations

- part_of [[FEAT-004 Registry-Based Installer]]
- implements [[REQ-003 Library Adoptions]]
- enables [[TASK-006 Claude Code Target]]
- enables [[TASK-007 Cursor Target]]
