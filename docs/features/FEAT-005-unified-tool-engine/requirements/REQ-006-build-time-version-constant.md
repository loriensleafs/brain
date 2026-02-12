---
title: REQ-006 Build-Time Version Constant
type: requirement
status: proposed
feature-ref: FEAT-005
permalink: features/feat-005-unified-tool-engine/requirements/req-006-build-time-version-constant
---

# REQ-006 Build-Time Version Constant

## Requirement Statement

The hardcoded `"version": "2.0.0"` string in `cmd/install.go` MUST be replaced with a build-time constant set via `-ldflags`. A `version.go` file in `internal/version/` MUST declare the version variable with a default development value. The Makefile and GoReleaser configuration MUST set the version from the release tag at build time.

### Version Module

```go
// internal/version/version.go
package version

// Version is set at build time via -ldflags.
// Default value "dev" is used for local development builds.
var Version = "dev"
```

### Build Integration

```text
Build-time injection:
  go build -ldflags "-X github.com/.../internal/version.Version=0.1.13"

GoReleaser:
  ldflags:
    - -X github.com/.../internal/version.Version={{ .Version }}

Makefile:
  VERSION ?= $(shell git describe --tags --always)
  LDFLAGS := -X github.com/.../internal/version.Version=$(VERSION)
```

### Usage Sites

All locations that reference a version string MUST use `version.Version` instead of hardcoded values:

1. `cmd/install.go` - manifest version field
2. `internal/installer/targets/` - plugin.json version (if applicable)
3. Any future version references

## Acceptance Criteria

- [ ] [requirement] `internal/version/version.go` defines `Version` variable with default "dev" #acceptance
- [ ] [requirement] Hardcoded "2.0.0" in `cmd/install.go` replaced with `version.Version` #acceptance
- [ ] [requirement] GoReleaser config sets version from release tag via -ldflags #acceptance
- [ ] [requirement] Makefile sets version from `git describe` via -ldflags #acceptance
- [ ] [requirement] Local development builds report "dev" as version #acceptance
- [ ] [requirement] Release builds report the correct semver tag as version #acceptance

## Observations

- [requirement] Build-time injection is standard Go practice for version reporting #technique
- [fact] Current hardcoded "2.0.0" in cmd/install.go:367 is stale and inaccurate #problem
- [constraint] GoReleaser and Makefile must both set the same ldflags pattern #consistency
- [insight] Default "dev" value ensures local builds work without special flags #developer-experience

## Relations

- part_of [[FEAT-005 Unified Tool Engine]]
- implements [[ADR-009 Unified Tool Engine]]
- relates_to [[TASK-002 Build-Time Version Constant]]
- relates_to [[ADR-006 Release Workflow and Distribution]]
