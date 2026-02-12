package installer_test

import (
	"context"
	"testing"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// stubInstaller is a minimal Tool implementation for testing.
type stubInstaller struct {
	name        string
	displayName string
	configDir   string
	target      string
}

func (s *stubInstaller) Name() string                                                  { return s.name }
func (s *stubInstaller) DisplayName() string                                           { return s.displayName }
func (s *stubInstaller) ConfigDir() string                                             { return s.configDir }
func (s *stubInstaller) IsToolInstalled() bool                                         { return false }
func (s *stubInstaller) IsBrainInstalled() bool                                        { return false }
func (s *stubInstaller) Install(_ context.Context, _ *installer.TemplateSource) error     { return nil }
func (s *stubInstaller) Uninstall(_ context.Context) error                             { return nil }
func (s *stubInstaller) AdapterTarget() string                                         { return s.target }

func newStub(name string) *stubInstaller {
	return &stubInstaller{
		name:        name,
		displayName: name,
		configDir:   "/tmp/" + name,
		target:      name,
	}
}

func TestRegisterAndGet(t *testing.T) {
	installer.ResetRegistry()

	stub := newStub("test-tool")
	installer.Register(stub)

	got, ok := installer.Get("test-tool")
	if !ok {
		t.Fatal("expected to find registered installer")
	}
	if got.Name() != "test-tool" {
		t.Errorf("got Name() = %q, want %q", got.Name(), "test-tool")
	}
}

func TestGetNotFound(t *testing.T) {
	installer.ResetRegistry()

	_, ok := installer.Get("nonexistent")
	if ok {
		t.Error("expected ok to be false for unregistered slug")
	}
}

func TestRegisterDuplicatePanics(t *testing.T) {
	installer.ResetRegistry()

	installer.Register(newStub("dup"))

	defer func() {
		r := recover()
		if r == nil {
			t.Fatal("expected panic on duplicate registration")
		}
		msg, ok := r.(string)
		if !ok {
			t.Fatalf("expected string panic, got %T", r)
		}
		if msg != "installer: duplicate registration for dup" {
			t.Errorf("unexpected panic message: %s", msg)
		}
	}()

	installer.Register(newStub("dup"))
}

func TestAllReturnsSorted(t *testing.T) {
	installer.ResetRegistry()

	// Register in non-alphabetical order.
	installer.Register(newStub("zeta"))
	installer.Register(newStub("alpha"))
	installer.Register(newStub("middle"))

	all := installer.All()
	if len(all) != 3 {
		t.Fatalf("expected 3 installers, got %d", len(all))
	}

	want := []string{"alpha", "middle", "zeta"}
	for i, inst := range all {
		if inst.Name() != want[i] {
			t.Errorf("All()[%d].Name() = %q, want %q", i, inst.Name(), want[i])
		}
	}
}

func TestAllEmptyRegistry(t *testing.T) {
	installer.ResetRegistry()

	all := installer.All()
	if len(all) != 0 {
		t.Fatalf("expected 0 installers, got %d", len(all))
	}
}

func TestAllReturnsCopy(t *testing.T) {
	installer.ResetRegistry()

	installer.Register(newStub("one"))
	installer.Register(newStub("two"))

	first := installer.All()
	second := installer.All()

	// Mutating the first slice should not affect the second.
	first[0] = newStub("mutated")

	if second[0].Name() == "mutated" {
		t.Error("All() should return independent slices")
	}
}

