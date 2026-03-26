import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);
const { evaluate } = require(path.join(repoRoot, "bin", "apex-lite.js"));
const policyPath = path.join(repoRoot, "examples", "policy.yaml");

// ------------------------------------------------------------------
// APEX Lite decision model: ALLOW or REQUIRE_APPROVAL (no DENY).
//
// REQUIRE_APPROVAL is not a failure — it means the agent declared its
// intent honestly and the policy correctly escalated it for human
// review. Escalation is the system working as designed.
//
// There is no DENY because hard blocks create an incentive to game
// the system. Without a block to avoid, agents have no reason to
// misrepresent intent. Transparency becomes the optimal strategy.
// ------------------------------------------------------------------

const cases = [
  {
    // Agent honestly declared PII involvement — escalation is the
    // correct and rewarded outcome here.
    name: "requires approval for PII email",
    intent: path.join(repoRoot, "examples", "intent.json"),
    expectedDecision: "REQUIRE_APPROVAL",
    expectedPolicyId: "rule_02"
  },
  {
    // Agent accurately reported high risk — the system rewards this
    // transparency by routing to human oversight.
    name: "requires approval for high-risk actions",
    intent: path.join(repoRoot, "examples", "intent-high-risk.json"),
    expectedDecision: "REQUIRE_APPROVAL",
    expectedPolicyId: "rule_01"
  },
  {
    // Low-risk action with no sensitive data — allowed to proceed
    // without friction.
    name: "allows safe actions",
    intent: path.join(repoRoot, "examples", "intent-safe.json"),
    expectedDecision: "ALLOW",
    expectedPolicyId: null
  }
];

for (const testCase of cases) {
  const result = evaluate(testCase.intent, policyPath);

  if (result.decision !== testCase.expectedDecision) {
    throw new Error(`${testCase.name}: expected ${testCase.expectedDecision}, got ${result.decision}`);
  }

  if (result.policy_id !== testCase.expectedPolicyId) {
    throw new Error(`${testCase.name}: expected policy ${testCase.expectedPolicyId}, got ${result.policy_id}`);
  }

  console.log(`passed: ${testCase.name}`);
}

console.log("All APEX Lite tests passed.");
