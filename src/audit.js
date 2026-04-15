const fs = require("node:fs");
const path = require("node:path");

function appendAuditLog(filePath, receipt) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.appendFileSync(filePath, JSON.stringify(receipt) + "\n", "utf8");
}

function readAuditLog(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }

  return fs
    .readFileSync(filePath, "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

function findReceiptByHash(filePath, receiptHash) {
  return findReceiptByHashInEntries(readAuditLog(filePath), receiptHash);
}

function findOperatorActionByReceiptHash(filePath, receiptHash) {
  return findOperatorActionByReceiptHashInEntries(readAuditLog(filePath), receiptHash);
}

function findReceiptByHashInEntries(entries, receiptHash) {
  return entries.find((entry) => {
    return entry.receipt_type === "apex-lite.receipt" && entry.receipt_hash === receiptHash;
  }) || null;
}

function findOperatorActionByReceiptHashInEntries(entries, receiptHash) {
  return entries.find((entry) => {
    return entry.receipt_type === "apex-lite.operator_action" && entry.receipt_hash === receiptHash;
  }) || null;
}

module.exports = {
  appendAuditLog,
  findOperatorActionByReceiptHash,
  findOperatorActionByReceiptHashInEntries,
  findReceiptByHash,
  findReceiptByHashInEntries,
  readAuditLog
};
