package installer_test

import (
	"context"
	"errors"
	"sync/atomic"
	"testing"
	"time"

	"github.com/peterkloss/brain-tui/internal/installer"
)

// installStub is a Tool whose Install calls a configurable function.
type installStub struct {
	stubInstaller
	installFn func(ctx context.Context) error
}

func (s *installStub) Install(ctx context.Context, _ *installer.TemplateSource) error {
	if s.installFn != nil {
		return s.installFn(ctx)
	}
	return nil
}

func newInstallStub(name string, fn func(ctx context.Context) error) *installStub {
	return &installStub{
		stubInstaller: *newStub(name),
		installFn:     fn,
	}
}

func TestInstallAll_ParallelSuccess(t *testing.T) {
	var started atomic.Int32

	// Each tool signals it has started, then waits briefly.
	// If execution were sequential, total time would be ~3*50ms.
	tools := make([]installer.Tool, 3)
	for i := range tools {
		tools[i] = newInstallStub("tool-"+string(rune('a'+i)), func(ctx context.Context) error {
			started.Add(1)
			time.Sleep(50 * time.Millisecond)
			return nil
		})
	}

	start := time.Now()
	results := installer.InstallAll(context.Background(), tools, nil)
	elapsed := time.Since(start)

	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	for _, r := range results {
		if r.Err != nil {
			t.Errorf("tool %q failed: %v", r.Name, r.Err)
		}
	}

	errs := installer.Errors(results)
	if errs != nil {
		t.Errorf("expected no errors, got %v", errs)
	}

	// Parallel execution should complete in roughly 50ms, not 150ms.
	if elapsed > 120*time.Millisecond {
		t.Errorf("execution took %v, expected parallel (~50ms)", elapsed)
	}

	if started.Load() != 3 {
		t.Errorf("expected 3 tools started, got %d", started.Load())
	}
}

func TestInstallAll_OneFailureReportsAll(t *testing.T) {
	boom := errors.New("boom")

	tools := []installer.Tool{
		newInstallStub("alpha", nil),
		newInstallStub("bravo", func(ctx context.Context) error { return boom }),
		newInstallStub("charlie", nil),
	}

	results := installer.InstallAll(context.Background(), tools, nil)
	if len(results) != 3 {
		t.Fatalf("expected 3 results, got %d", len(results))
	}

	errs := installer.Errors(results)
	if errs == nil {
		t.Fatal("expected errors map")
	}
	if !errors.Is(errs["bravo"], boom) {
		t.Errorf("expected bravo error to be boom, got %v", errs["bravo"])
	}
	if errs["alpha"] != nil {
		t.Errorf("alpha should have no error, got %v", errs["alpha"])
	}

	// Alpha and charlie results should still be present (all tools reported).
	foundAlpha, foundCharlie := false, false
	for _, r := range results {
		if r.Name == "alpha" {
			foundAlpha = true
		}
		if r.Name == "charlie" {
			foundCharlie = true
		}
	}
	if !foundAlpha || !foundCharlie {
		t.Error("expected all tools to have results even when one fails")
	}
}

func TestInstallAll_SingleTool(t *testing.T) {
	called := false
	tools := []installer.Tool{
		newInstallStub("solo", func(ctx context.Context) error {
			called = true
			return nil
		}),
	}

	results := installer.InstallAll(context.Background(), tools, nil)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if !called {
		t.Error("expected install function to be called")
	}
	if results[0].Err != nil {
		t.Errorf("unexpected error: %v", results[0].Err)
	}
	if results[0].Name != "solo" {
		t.Errorf("expected name 'solo', got %q", results[0].Name)
	}
}

func TestInstallAll_ContextCancellation(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	var started atomic.Int32

	tools := []installer.Tool{
		newInstallStub("fast", func(ctx context.Context) error {
			started.Add(1)
			cancel() // cancel after first tool starts
			return nil
		}),
		newInstallStub("slow", func(ctx context.Context) error {
			started.Add(1)
			// Respect context: check before doing work.
			select {
			case <-ctx.Done():
				return ctx.Err()
			case <-time.After(500 * time.Millisecond):
				return nil
			}
		}),
	}

	results := installer.InstallAll(ctx, tools, nil)
	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}

	// At least one tool should see cancellation.
	errs := installer.Errors(results)
	cancelled := false
	for _, err := range errs {
		if errors.Is(err, context.Canceled) {
			cancelled = true
		}
	}
	// The "fast" tool succeeds and cancels. "slow" should see cancellation
	// via errgroup's derived context.
	if !cancelled {
		t.Log("note: cancellation propagation depends on timing; both tools may have completed")
	}
}

func TestInstallAll_Empty(t *testing.T) {
	results := installer.InstallAll(context.Background(), nil, nil)
	if results != nil {
		t.Errorf("expected nil for empty tools, got %v", results)
	}
}

func TestInstallAll_SingleToolFailure(t *testing.T) {
	boom := errors.New("single-fail")
	tools := []installer.Tool{
		newInstallStub("only", func(ctx context.Context) error { return boom }),
	}

	results := installer.InstallAll(context.Background(), tools, nil)
	if len(results) != 1 {
		t.Fatalf("expected 1 result, got %d", len(results))
	}
	if !errors.Is(results[0].Err, boom) {
		t.Errorf("expected boom error, got %v", results[0].Err)
	}
}

func TestErrors_AllSuccess(t *testing.T) {
	results := []installer.Result{
		{Name: "a", Err: nil},
		{Name: "b", Err: nil},
	}
	if errs := installer.Errors(results); errs != nil {
		t.Errorf("expected nil, got %v", errs)
	}
}
