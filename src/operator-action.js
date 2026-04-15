const path = require("node:path");
const {
  appendAuditLog,
  findOperatorActionByReceiptHashInEntries,
  findReceiptByHashInEntries,
  readAuditLog
} = require("./audit");

const { version } = require(path.join(__dirname, "..", "package.json"));

function recordOperatorAction(payload, auditPath) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Request body must be a JSON object.");
  }

  const action = normalizeAction(payload.action);
  const receipt = normalizeReceipt(payload.receipt);
  const auditEntries = readAuditLog(auditPath);
  const recordedReceipt = verifyRecordedReceipt(receipt, auditEntries);
  const operator = normalizeOperator(payload.operator);
  const entry = {
    receipt_type: "apex-lite.operator_action",
    apex_version: version,
    action_at: new Date().toISOString(),
    action,
    operator,
    intent_id: recordedReceipt.original_intent.intent_id || null,
    execution_ref: recordedReceipt.execution_ref,
    receipt_hash: recordedReceipt.receipt_hash,
    intent_hash: recordedReceipt.intent_hash,
    policy_id: recordedReceipt.policy_id || null,
    policy_hash: recordedReceipt.policy_hash,
    original_decision: recordedReceipt.decision,
    original_reason: recordedReceipt.reason,
    outcome: action === "APPROVE" ? "ALLOW" : "ESCALATED_TO_HUMAN",
    reward_signal: action === "ESCALATE" ? "TRANSPARENCY_REWARDED" : "ESCALATION_RESOLVED"
  };

  appendAuditLog(auditPath, entry);
  return entry;
}

function normalizeAction(value) {
  if (value === "approve") {
    return "APPROVE";
  }

  if (value === "escalate") {
    return "ESCALATE";
  }

  throw new Error("Action must be 'approve' or 'escalate'.");
}

function normalizeReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    throw new Error("A receipt is required for operator actions.");
  }

  if (!receipt.intent_hash || !receipt.policy_hash || !receipt.receipt_hash) {
    throw new Error("Operator actions require a valid evaluation receipt.");
  }

  if (!receipt.original_intent || typeof receipt.original_intent !== "object") {
    throw new Error("Operator actions require the original intent.");
  }

  return receipt;
}

function normalizeOperator(value) {
  const operator = typeof value === "string" ? value.trim() : "";

  if (!operator) {
    return "local_operator";
  }

  if (!/^[A-Za-z0-9_.:-]{1,64}$/.test(operator)) {
    throw new Error("Operator must use 1-64 characters from A-Z, a-z, 0-9, ., _, :, or -.");
  }

  return operator;
}

function verifyRecordedReceipt(receipt, auditEntries) {
  const recordedReceipt = findReceiptByHashInEntries(auditEntries, receipt.receipt_hash);

  if (!recordedReceipt) {
    throw new Error("Operator actions require a recorded evaluation receipt.");
  }

  if (recordedReceipt.decision !== "REQUIRE_APPROVAL") {
    throw new Error("Operator actions are only valid for escalated evaluations.");
  }

  if (recordedReceipt.intent_hash !== receipt.intent_hash || recordedReceipt.policy_hash !== receipt.policy_hash) {
    throw new Error("Operator action receipt does not match the recorded evaluation.");
  }

  if (recordedReceipt.execution_ref !== receipt.execution_ref) {
    throw new Error("Operator action execution reference does not match the recorded evaluation.");
  }

  if (findOperatorActionByReceiptHashInEntries(auditEntries, receipt.receipt_hash)) {
    throw new Error("This escalated evaluation already has a recorded operator outcome.");
  }

  return recordedReceipt;
}

module.exports = {
  recordOperatorAction
};
