## Task Dependency Patterns

Task dependencies replace manual wave management. Express the same patterns declaratively:

### Pattern: Research Swarm --> Review --> Implementation Swarm --> QA

```python
# Wave 1 equivalent: Research (no deps)
TaskCreate(subject="Research topic A")       # -> #1
TaskCreate(subject="Research topic B")       # -> #2
TaskCreate(subject="Research topic C")       # -> #3

# Wave 2 equivalent: Reviews (depend on all research)
TaskCreate(subject="Design review", depends_on=[1, 2, 3])    # -> #4
TaskCreate(subject="Security review", depends_on=[1, 2, 3])  # -> #5

# Wave 3 equivalent: Implementation (depends on reviews)
TaskCreate(subject="Implement module A", depends_on=[4, 5])   # -> #6
TaskCreate(subject="Implement module B", depends_on=[4, 5])   # -> #7

# Wave 4 equivalent: QA (depends on all implementation)
TaskCreate(subject="Test suite", depends_on=[6, 7])            # -> #8
```

### Pattern: Fan-Out / Fan-In

```python
# Fan-out: One research task unlocks 5 parallel implementation tasks
TaskCreate(subject="Analyze requirements")       # -> #1
TaskCreate(subject="Impl part A", depends_on=[1])  # -> #2
TaskCreate(subject="Impl part B", depends_on=[1])  # -> #3
TaskCreate(subject="Impl part C", depends_on=[1])  # -> #4
TaskCreate(subject="Impl part D", depends_on=[1])  # -> #5
TaskCreate(subject="Impl part E", depends_on=[1])  # -> #6

# Fan-in: All 5 converge into one review
TaskCreate(subject="Integration review", depends_on=[2, 3, 4, 5, 6])  # -> #7
```

### Pattern: Pipeline with Parallel Branches

```python
TaskCreate(subject="Analyze codebase")                    # -> #1

# Two independent review branches from same input
TaskCreate(subject="Architecture review", depends_on=[1]) # -> #2
TaskCreate(subject="Security audit", depends_on=[1])      # -> #3

# Implementation needs both reviews
TaskCreate(subject="Implement changes", depends_on=[2, 3])  # -> #4

# QA needs implementation
TaskCreate(subject="Run tests", depends_on=[4])              # -> #5
```
