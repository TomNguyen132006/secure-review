function maskSecretValue(text = "") {
  return text.replace(/(["'])([^"']{4})[^"']{4,}(["'])/g, '$1$2********$3');
}

module.exports = { maskSecretValue };