# APEX Lite - Example Flow

This directory demonstrates a minimal APEX Lite evaluation flow.

## Files

- `intent.json`  
  Declared agent intent represented as explicit metadata.

- `policy.yaml`  
  Local, human-defined rules used to evaluate intent.

- `decision.json`  
  Deterministic outcome produced by evaluating intent against policy.

## What This Example Shows

- Intent is evaluated **before execution**
- Decisions are deterministic and inspectable
- Policy is external to the agent or model
- Execution does not occur unless explicitly allowed

## What This Example Does Not Show

- How execution is performed
- How approvals are handled
- How agents are coordinated
- How policies are distributed or enforced

Those concerns are intentionally out of scope.
