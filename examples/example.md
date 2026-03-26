# APEX Lite - Example Flow

This directory demonstrates a minimal APEX Lite evaluation flow.

## Files

- `intent.json`  
  Declared agent intent represented as explicit metadata.

- `policy.yaml`  
  Local, human-defined rules used to evaluate intent.

- `decision.json`  
  Deterministic outcome produced by evaluating intent against policy.

- `intent-high-risk.json`
  Example intent that matches a high-risk approval rule.

- `intent-safe.json`
  Example intent that matches no rules and is allowed.

## What This Example Shows

- Intent is evaluated **before execution**
- Decisions are deterministic and inspectable
- Policy is external to the agent or model
- Execution does not occur unless explicitly allowed
- The included evaluator supports the small rule grammar used in this repository

## What This Example Does Not Show

- How execution is performed
- How approvals are handled
- How agents are coordinated
- How policies are distributed or enforced

Those concerns are intentionally out of scope.
