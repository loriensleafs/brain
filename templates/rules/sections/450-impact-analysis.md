### Impact Analysis

For multi-domain changes (3+ areas, architecture, security, infrastructure, breaking changes):

1. {{role_title}} {{route_verb}} planner with impact analysis flag
2. Planner identifies scope and creates analysis plan
3. {{role_title}} invokes ALL specialists in parallel: implementer (code) + architect (design) + security (security) + devops (ops) + qa (quality)
4. {{role_title}} aggregates findings, routes to critic for validation

Each specialist creates: `planning/IMPACT-ANALYSIS-[domain]-[feature].md`
