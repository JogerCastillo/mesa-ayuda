const fs = require("fs");
const path = require("path");

const ensureFile = (filePath, fallbackValue) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf8");
  }
};

const readJson = (filePath, fallbackValue = []) => {
  ensureFile(filePath, fallbackValue);
  const raw = fs.readFileSync(filePath, "utf8");
  try {
    return JSON.parse(raw);
  } catch {
    fs.writeFileSync(filePath, JSON.stringify(fallbackValue, null, 2), "utf8");
    return fallbackValue;
  }
};

const writeJson = (filePath, value) => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), "utf8");
};

module.exports = {
  readJson,
  writeJson
};
