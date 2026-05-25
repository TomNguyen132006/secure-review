/**
 * Task 3.6 — Minh Nguyen
 * Starts Express backend server.
 */

const app = require("./app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Secure Review backend running on port ${PORT}`);
});