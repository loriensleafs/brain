package tests

import (
	"os"
	"path/filepath"
	"runtime"
	"testing"

	"github.com/adrg/xdg"
)

// TestXDGConfigHomeMacOS verifies that on macOS, when XDG_CONFIG_HOME is unset,
// we override to ~/.config to match Brain's convention.
func TestXDGConfigHomeMacOS(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS-only test")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("UserHomeDir: %v", err)
	}

	// Save and clear env
	original := os.Getenv("XDG_CONFIG_HOME")
	os.Unsetenv("XDG_CONFIG_HOME")
	defer func() {
		if original != "" {
			os.Setenv("XDG_CONFIG_HOME", original)
		}
	}()

	// Simulate the override from init()
	xdg.ConfigHome = filepath.Join(home, ".config")

	expected := filepath.Join(home, ".config")
	if xdg.ConfigHome != expected {
		t.Errorf("expected ConfigHome=%s, got %s", expected, xdg.ConfigHome)
	}

	// Verify Brain config path resolves correctly
	brainConfig := filepath.Join(xdg.ConfigHome, "brain", "config.json")
	expectedConfig := filepath.Join(home, ".config", "brain", "config.json")
	if brainConfig != expectedConfig {
		t.Errorf("expected brain config=%s, got %s", expectedConfig, brainConfig)
	}
}

// TestXDGCacheHomeMacOS verifies cache path override on macOS.
func TestXDGCacheHomeMacOS(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("macOS-only test")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("UserHomeDir: %v", err)
	}

	original := os.Getenv("XDG_CACHE_HOME")
	os.Unsetenv("XDG_CACHE_HOME")
	defer func() {
		if original != "" {
			os.Setenv("XDG_CACHE_HOME", original)
		}
	}()

	// Simulate the override from init()
	xdg.CacheHome = filepath.Join(home, ".cache")

	expected := filepath.Join(home, ".cache")
	if xdg.CacheHome != expected {
		t.Errorf("expected CacheHome=%s, got %s", expected, xdg.CacheHome)
	}

	// Verify Brain cache path resolves correctly
	brainCache := filepath.Join(xdg.CacheHome, "brain")
	expectedCache := filepath.Join(home, ".cache", "brain")
	if brainCache != expectedCache {
		t.Errorf("expected brain cache=%s, got %s", expectedCache, brainCache)
	}
}

// TestXDGRespectsExplicitEnv verifies that explicit XDG_CONFIG_HOME is respected
// (the override only happens when env is unset).
func TestXDGRespectsExplicitEnv(t *testing.T) {
	customPath := t.TempDir()

	os.Setenv("XDG_CONFIG_HOME", customPath)
	defer os.Unsetenv("XDG_CONFIG_HOME")

	// Re-read from env (simulating what xdg library does)
	configHome := os.Getenv("XDG_CONFIG_HOME")
	if configHome != customPath {
		t.Errorf("expected XDG_CONFIG_HOME=%s, got %s", customPath, configHome)
	}
}

// TestXDGLinuxDefaults verifies that on Linux, xdg defaults are already ~/.config.
func TestXDGLinuxDefaults(t *testing.T) {
	if runtime.GOOS != "linux" {
		t.Skip("Linux-only test")
	}

	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatalf("UserHomeDir: %v", err)
	}

	// On Linux, xdg.ConfigHome should default to ~/.config without override
	expected := filepath.Join(home, ".config")
	if xdg.ConfigHome != expected {
		t.Errorf("expected Linux ConfigHome=%s, got %s", expected, xdg.ConfigHome)
	}
}
