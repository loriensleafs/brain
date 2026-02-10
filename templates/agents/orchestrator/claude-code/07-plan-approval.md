## Plan Approval Mode

For critical work (architecture, security-sensitive changes), spawn teammates with plan approval required:

```python
Task(
    team_name="feature-auth-refactor",
    name="architect",
    subagent_type="architect",
    prompt="Design the new auth module architecture. Create a plan before implementing.",
    plan_mode_required=True,  # Teammate works in read-only until you approve
    run_in_background=True
)
```

When the architect submits a plan:

1. You receive a `plan_approval_request` in your inbox
2. Review the plan
3. Approve: `Teammate(operation="approvePlan", target_agent_id="architect", request_id="plan-456")`
4. Or reject with feedback: `Teammate(operation="rejectPlan", target_agent_id="architect", request_id="plan-456", reason="Missing cache invalidation strategy")`
5. Teammate revises and resubmits
