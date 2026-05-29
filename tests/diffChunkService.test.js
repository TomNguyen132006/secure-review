const { splitDiffByFile } = require("../services/diffChunkService");

describe("diffChunkService", () => {
  test("should return empty array for empty diff", () => {
    const result = splitDiffByFile("");

    expect(result).toEqual([]);
  });

  test("should return empty array for null or undefined diff", () => {
    expect(splitDiffByFile(null)).toEqual([]);
    expect(splitDiffByFile(undefined)).toEqual([]);
  });

  test("should split diff by file headers", () => {
    const diff = `diff --git a/src/file1.js b/src/file1.js
index 111..222 100644
--- a/src/file1.js
+++ b/src/file1.js
@@ -1,3 +1,3 @@
-const password = "123";
+const password = process.env.PASSWORD;

diff --git a/src/file2.js b/src/file2.js
index 333..444 100644
--- a/src/file2.js
+++ b/src/file2.js
@@ -1,3 +1,3 @@
-console.log("old");
+console.log("new");
`;

    const result = splitDiffByFile(diff);

    expect(result).toHaveLength(2);

    expect(result[0]).toContain("diff --git a/src/file1.js b/src/file1.js");
    expect(result[0]).toContain('const password = "123"');

    expect(result[1]).toContain("diff --git a/src/file2.js b/src/file2.js");
    expect(result[1]).toContain('console.log("new")');
  });

  test("each chunk should contain only one changed file", () => {
    const diff = `diff --git a/a.js b/a.js
@@ -1 +1 @@
-old
+new

diff --git a/b.js b/b.js
@@ -1 +1 @@
-old
+new
`;

    const result = splitDiffByFile(diff);

    expect(result[0]).toContain("a.js");
    expect(result[0]).not.toContain("b.js");

    expect(result[1]).toContain("b.js");
  });

  test("should handle a single file diff", () => {
    const diff = `diff --git a/src/app.js b/src/app.js
@@ -1 +1 @@
-old code
+new code
`;

    const result = splitDiffByFile(diff);

    expect(result).toHaveLength(1);
    expect(result[0]).toContain("src/app.js");
    expect(result[0]).toContain("+new code");
  });
});