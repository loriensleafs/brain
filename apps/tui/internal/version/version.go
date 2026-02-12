// Package version holds the build-time version constant.
// Override at build time with:
//
//	go build -ldflags "-X github.com/peterkloss/brain-tui/internal/version.Version=1.2.3"
package version

// Version is set at build time via ldflags. Defaults to "dev" for
// untagged development builds.
var Version = "dev"
