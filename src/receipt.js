const { sha256Hex, stableStringify } = require("./hash");

function buildReceipt({ intent, policy, decision, evaluatedAt, apexVersion }) {
  const receipt = {
    receipt_type: "apex-lite.receipt",
    apex_version: apexVersion,
    evaluated_at: evaluatedAt,
    control_mode: "ALLOW_OR_ESCALATE",
    blocking: false,
    decision: decision.decision,
    reason: decision.reason,
    policy_id: decision.policy_id,
    policy_hash: sha256Hex(stableStringify(policy)),
    intent_hash: sha256Hex(stableStringify(intent)),
    reward_signal: decision.decision === "ALLOW" ? null : "TRANSPARENCY_REWARDED",
    original_intent: intent
  };

  receipt.receipt_hash = sha256Hex(stableStringify(receipt));
  receipt.execution_ref = `exec_${receipt.receipt_hash.slice(0, 16)}`;
  return receipt;
}

module.exports = {
  buildReceipt
};
