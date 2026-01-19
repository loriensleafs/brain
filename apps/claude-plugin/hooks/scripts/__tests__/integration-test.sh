#!/bin/bash
# Integration tests for Brain hooks and CLI commands
# Run from the hooks/scripts/__tests__ directory or via absolute path

# Don't use set -e as it causes issues with arithmetic expansion when PASS/FAIL is 0

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BRAIN_CLI="${HOME}/Dev/brain/apps/tui/brain"
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    PASS=$((PASS + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    FAIL=$((FAIL + 1))
}

log_info() {
    echo -e "${YELLOW}[INFO]${NC} $1"
}

echo "=================================="
echo "Brain Hook Integration Tests"
echo "=================================="
echo ""

# Pre-flight checks
log_info "Checking prerequisites..."

if [ ! -x "$BRAIN_CLI" ]; then
    log_fail "brain CLI not found at $BRAIN_CLI"
    echo "Build with: cd ~/Dev/brain/apps/tui && go build -o brain ."
    exit 1
fi
log_pass "brain CLI found"

# Check MCP server status (optional - tests should work without it)
if "$BRAIN_CLI" mcp status 2>/dev/null | grep -q "running"; then
    log_pass "brain MCP server running"
else
    log_info "brain MCP server not running (tests may have limited functionality)"
fi

echo ""
echo "== CLI Command Tests =="
echo ""

# Test 1: brain bootstrap
log_info "Testing: brain bootstrap"
OUTPUT=$("$BRAIN_CLI" bootstrap --timeframe 1d 2>&1) || true
if [ -n "$OUTPUT" ]; then
    log_pass "brain bootstrap returns output"
else
    log_fail "brain bootstrap - no output"
fi

# Test 2: brain workflow get-state
log_info "Testing: brain workflow get-state"
OUTPUT=$("$BRAIN_CLI" workflow get-state 2>&1) || true
if echo "$OUTPUT" | grep -qE '(\{|\}|mode|sessionId|error)'; then
    log_pass "brain workflow get-state returns JSON or error"
else
    log_fail "brain workflow get-state - unexpected output: $OUTPUT"
fi

# Test 3: brain validate session
log_info "Testing: brain validate session"
OUTPUT=$("$BRAIN_CLI" validate session 2>&1) || true
if [ -n "$OUTPUT" ]; then
    log_pass "brain validate session returns output"
else
    log_fail "brain validate session - no output"
fi

echo ""
echo "== Hook Script Tests =="
echo ""

# Test 4: workflow-state-loader.sh (SessionStart)
log_info "Testing: workflow-state-loader.sh"
if [ -x "$SCRIPT_DIR/workflow-state-loader.sh" ]; then
    OUTPUT=$("$SCRIPT_DIR/workflow-state-loader.sh" 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log_pass "workflow-state-loader.sh exits 0 (graceful degradation)"
    else
        log_fail "workflow-state-loader.sh exit code $EXIT_CODE"
    fi
else
    log_fail "workflow-state-loader.sh not executable"
fi

# Test 5: workflow-state-injector.sh (UserPromptSubmit) - with planning keyword
log_info "Testing: workflow-state-injector.sh with planning keyword"
if [ -x "$SCRIPT_DIR/workflow-state-injector.sh" ]; then
    OUTPUT=$(echo "Let me plan the implementation" | "$SCRIPT_DIR/workflow-state-injector.sh" 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log_pass "workflow-state-injector.sh exits 0 (non-blocking)"
    else
        log_fail "workflow-state-injector.sh exit code $EXIT_CODE"
    fi
else
    log_fail "workflow-state-injector.sh not executable"
fi

# Test 6: workflow-state-injector.sh (UserPromptSubmit) - without keyword
log_info "Testing: workflow-state-injector.sh without keyword"
if [ -x "$SCRIPT_DIR/workflow-state-injector.sh" ]; then
    OUTPUT=$(echo "Hello world" | "$SCRIPT_DIR/workflow-state-injector.sh" 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log_pass "workflow-state-injector.sh exits 0 without keyword"
    else
        log_fail "workflow-state-injector.sh exit code $EXIT_CODE"
    fi
    # Without planning keywords, should produce empty or minimal output
    if [ -z "$OUTPUT" ] || ! echo "$OUTPUT" | grep -q "Workflow State"; then
        log_pass "workflow-state-injector.sh no state injection without keyword"
    else
        log_info "Note: State was injected (keyword may have matched)"
    fi
else
    log_fail "workflow-state-injector.sh not executable"
fi

# Test 7: session-validator.sh (Stop)
log_info "Testing: session-validator.sh"
if [ -x "$SCRIPT_DIR/session-validator.sh" ]; then
    OUTPUT=$(echo "" | "$SCRIPT_DIR/session-validator.sh" 2>&1)
    EXIT_CODE=$?
    if [ $EXIT_CODE -eq 0 ]; then
        log_pass "session-validator.sh exits 0"
    else
        log_fail "session-validator.sh exit code $EXIT_CODE"
    fi
    if echo "$OUTPUT" | grep -qE '"continue":\s*(true|false)'; then
        log_pass "session-validator.sh outputs continue directive"
    else
        log_fail "session-validator.sh - missing continue directive in: $OUTPUT"
    fi
else
    log_fail "session-validator.sh not executable"
fi

echo ""
echo "== Keyword Detection Tests =="
echo ""

# Test keywords that should trigger state injection
TRIGGER_KEYWORDS=("plan" "implement" "design" "architect" "build" "create" "refactor" "fix" "add" "update" "feature" "task" "phase")

for keyword in "${TRIGGER_KEYWORDS[@]}"; do
    log_info "Testing keyword: $keyword"
    OUTPUT=$(echo "I want to $keyword something" | "$SCRIPT_DIR/workflow-state-injector.sh" 2>&1)
    # Just verify it runs without error
    if [ $? -eq 0 ]; then
        log_pass "Keyword '$keyword' handled without error"
    else
        log_fail "Keyword '$keyword' caused error"
    fi
done

echo ""
echo "== Timeout Tests =="
echo ""

# Test 8: Verify scripts complete within timeout
log_info "Testing: Script execution time"
TIMEOUT_SECS=10

for script in workflow-state-loader.sh workflow-state-injector.sh session-validator.sh; do
    if [ -x "$SCRIPT_DIR/$script" ]; then
        START=$(date +%s)
        echo "test" | timeout $TIMEOUT_SECS "$SCRIPT_DIR/$script" > /dev/null 2>&1 || true
        END=$(date +%s)
        DURATION=$((END - START))

        if [ $DURATION -lt $TIMEOUT_SECS ]; then
            log_pass "$script completes in ${DURATION}s (< ${TIMEOUT_SECS}s timeout)"
        else
            log_fail "$script exceeds timeout"
        fi
    fi
done

echo ""
echo "== Edge Case Tests =="
echo ""

# Test 9: Empty input handling
log_info "Testing: Empty input handling"
for script in workflow-state-loader.sh session-validator.sh; do
    if [ -x "$SCRIPT_DIR/$script" ]; then
        OUTPUT=$(echo "" | "$SCRIPT_DIR/$script" 2>&1)
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 0 ]; then
            log_pass "$script handles empty input"
        else
            log_fail "$script fails with empty input"
        fi
    fi
done

# Test 10: Large input handling (UserPromptSubmit)
log_info "Testing: Large input handling"
LARGE_INPUT=$(head -c 10000 /dev/zero | tr '\0' 'a')
OUTPUT=$(echo "$LARGE_INPUT plan something" | "$SCRIPT_DIR/workflow-state-injector.sh" 2>&1)
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    log_pass "workflow-state-injector.sh handles large input"
else
    log_fail "workflow-state-injector.sh fails with large input"
fi

# Test 11: Special characters in input
log_info "Testing: Special characters in input"
SPECIAL_INPUT='plan with "quotes" and $variables and `backticks`'
OUTPUT=$(echo "$SPECIAL_INPUT" | "$SCRIPT_DIR/workflow-state-injector.sh" 2>&1)
EXIT_CODE=$?
if [ $EXIT_CODE -eq 0 ]; then
    log_pass "workflow-state-injector.sh handles special characters"
else
    log_fail "workflow-state-injector.sh fails with special characters"
fi

echo ""
echo "=================================="
echo -e "Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC}"
echo "=================================="

if [ $FAIL -gt 0 ]; then
    exit 1
fi
exit 0
