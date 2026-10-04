const { scanSecurityPatterns } = require("../services/localSecurityScanner");

// Scan one added line as it appears in a merge request diff.
function scanLine(code) {
  return scanSecurityPatterns(
    ["diff --git a/src/app.js b/src/app.js", "+++ b/src/app.js", "@@ -0,0 +1,1 @@", `+${code}`].join(
      "\n"
    )
  );
}

function issueTypes(code) {
  return scanLine(code).map((finding) => finding.issueType);
}

const TEMPLATE_SQL = "SQL Injection Risk (Template Literal)";
const COMPARISON = "Hardcoded Password Comparison";
const WEAK = "Weak Authentication";

describe("rule: SQL built with template literals", () => {
  test.each([
    "db.query(`SELECT * FROM users WHERE id = ${id}`);",
    "const q = `select name from users where email = '${email}'`;",
    "await pool.query(`INSERT INTO logs (msg) VALUES ('${msg}')`);",
    "conn.execute(`UPDATE users SET name = '${name}' WHERE id = 1`);",
    "db.run(`DELETE FROM sessions WHERE token = '${token}'`);",
    "prisma.$queryRawUnsafe(`SELECT * FROM users WHERE id = ${req.params.id}`);",
  ])("flags %s", (code) => {
    const findings = scanLine(code).filter((finding) => finding.issueType === TEMPLATE_SQL);

    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({ riskLevel: "High", fileName: "src/app.js" });
  });

  test.each([
    // Parameterized query: no interpolation.
    "db.query(`SELECT * FROM users WHERE id = ?`, [id]);",
    // Template literal with interpolation, but not SQL.
    "const msg = `Hello ${name}, you selected ${item} from the menu`;",
    // Tagged templates are parameterized by their library.
    "const rows = await sql`SELECT * FROM users WHERE id = ${id}`;",
    "const rows = await prisma.$queryRaw`SELECT * FROM users WHERE id = ${id}`;",
    // SQL keywords in a plain string with no interpolation.
    'const help = "SELECT * FROM users WHERE id = $1";',
  ])("does not flag %s", (code) => {
    expect(issueTypes(code)).not.toContain(TEMPLATE_SQL);
  });
});

describe("rule: hardcoded password comparison", () => {
  test.each([
    'if (password === "Tr0ub4dor&3") {',
    "if (password !== 'correct-horse-battery') return deny();",
    'if (password == "S3cretValue") {',
    'if ("Tr0ub4dor&3" === password) {',
    'if (password.equals("Tr0ub4dor&3")) {',
  ])("flags %s as Medium", (code) => {
    const findings = scanLine(code).filter((finding) => finding.issueType === COMPARISON);

    expect(findings).toHaveLength(1);
    expect(findings[0].riskLevel).toBe("Medium");
  });

  test.each([
    'if (password === "admin") {',
    'if ("admin" === password) {',
    "if (password !== 'qwerty') return deny();",
    'if ("letmein" !== password) {',
  ])("keeps weak value %s as High Weak Authentication, without a duplicate Medium", (code) => {
    const types = issueTypes(code);

    expect(types).toContain(WEAK);
    expect(types).not.toContain(COMPARISON);
    expect(scanLine(code).find((finding) => finding.issueType === WEAK).riskLevel).toBe("High");
  });

  test("a value that only starts like a weak one is not treated as weak", () => {
    const types = issueTypes('if (password === "admin1234") {');

    expect(types).toContain(COMPARISON);
    expect(types).not.toContain(WEAK);
  });

  test.each([
    // Emptiness check, not a credential.
    'if (password === "") {',
    "if (password !== '') {",
    // Comparing two variables.
    "if (password === confirmPassword) {",
    'if (password.equals(storedPassword)) {',
    // Type check.
    'if (typeof password === "string") {',
    'if (typeof password !== "string") {',
    // Property of the password, not the password itself.
    "if (password.length === 8) {",
    // Assignment is reported by the Hardcoded Password rule, not as a comparison.
    'const password = "Tr0ub4dor&3";',
  ])("does not flag %s as a comparison", (code) => {
    expect(issueTypes(code)).not.toContain(COMPARISON);
  });

  test("typeof checks are not reported as weak authentication either", () => {
    expect(issueTypes('if (typeof password !== "password") {')).not.toContain(WEAK);
  });
});
