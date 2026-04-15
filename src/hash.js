const crypto = require("node:crypto");

function stableStringify(value) {
  return JSON.stringify(sortValue(value));
}

function sortValue(value) {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((result, key) => {
        result[key] = sortValue(value[key]);
        return result;
      }, {});
  }

  return value;
}

function sha256Hex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

module.exports = {
  sha256Hex,
  stableStringify
};
