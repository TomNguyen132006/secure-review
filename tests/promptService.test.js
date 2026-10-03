const { EventEmitter } = require("events");
const { Readable } = require("stream");

const { askHiddenQuestion } = require("../services/promptService");

const QUESTION = "Enter GitLab token: ";
const TOKEN = "glpat-xxxxxxxxxxxxxxxxxxxx";

// Minimal stand-in for a TTY stdin (Windows console or Unix terminal).
function createFakeTerminal({ isRaw = false } = {}) {
  const input = new EventEmitter();

  input.isTTY = true;
  input.isRaw = isRaw;
  input.setRawMode = jest.fn((mode) => {
    input.isRaw = mode;
    return input;
  });
  input.setEncoding = jest.fn();
  input.resume = jest.fn();
  input.pause = jest.fn();

  return input;
}

function createFakeOutput() {
  const chunks = [];

  return {
    write: jest.fn((chunk) => {
      chunks.push(String(chunk));
      return true;
    }),
    text: () => chunks.join(""),
  };
}

describe("askHiddenQuestion in an interactive terminal", () => {
  test("does not echo the typed token", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });

    for (const char of TOKEN) {
      input.emit("data", char);
    }
    input.emit("data", "\r");

    await expect(answer).resolves.toBe(TOKEN);
    expect(output.text()).toBe(`${QUESTION}\n`);
    expect(output.text()).not.toContain("glpat");
  });

  test("turns raw mode on while reading and restores it afterwards", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", `${TOKEN}\r`);
    await answer;

    expect(input.setRawMode.mock.calls).toEqual([[true], [false]]);
    expect(input.listenerCount("data")).toBe(0);
    expect(input.pause).toHaveBeenCalled();
  });

  test("keeps raw mode on if it was already on", async () => {
    const input = createFakeTerminal({ isRaw: true });
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", `${TOKEN}\r`);
    await answer;

    expect(input.setRawMode).toHaveBeenLastCalledWith(true);
  });

  test("accepts a pasted token ending in CRLF in one chunk (Windows paste)", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", `${TOKEN}\r\n`);

    await expect(answer).resolves.toBe(TOKEN);
  });

  test("handles Backspace (DEL on macOS/Linux, BS on Windows)", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", "glpat-abX");
    input.emit("data", "\u007f");
    input.emit("data", "cY");
    input.emit("data", "\b");
    input.emit("data", "\r");

    await expect(answer).resolves.toBe("glpat-abc");
    expect(output.text()).toBe(`${QUESTION}\n`);
  });

  test("ignores arrow keys and other escape sequences", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", "glpat-");
    input.emit("data", "\u001b[D");
    input.emit("data", "abc\u001b[A\r");

    await expect(answer).resolves.toBe("glpat-abc");
  });

  test("Ctrl+C cancels and restores the terminal", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", "glpat-par");
    input.emit("data", "\u0003");

    await expect(answer).rejects.toMatchObject({ code: "PROMPT_CANCELLED" });
    expect(input.setRawMode).toHaveBeenLastCalledWith(false);
    expect(input.listenerCount("data")).toBe(0);
  });

  test("Ctrl+D on an empty line returns an empty answer", async () => {
    const input = createFakeTerminal();
    const output = createFakeOutput();

    const answer = askHiddenQuestion(QUESTION, { input, output, env: {} });
    input.emit("data", "\u0004");

    await expect(answer).resolves.toBe("");
  });
});

describe("askHiddenQuestion with piped (non-TTY) input", () => {
  test("reads the first line", async () => {
    const output = createFakeOutput();
    const input = Readable.from([`${TOKEN}\nsecond line\n`]);

    await expect(askHiddenQuestion(QUESTION, { input, output, env: {} })).resolves.toBe(TOKEN);
  });

  test("handles Windows CRLF line endings", async () => {
    const output = createFakeOutput();
    const input = Readable.from([`${TOKEN}\r\n`]);

    await expect(askHiddenQuestion(QUESTION, { input, output, env: {} })).resolves.toBe(TOKEN);
  });

  test("returns an empty answer when input is empty", async () => {
    const output = createFakeOutput();
    const input = Readable.from([]);

    await expect(askHiddenQuestion(QUESTION, { input, output, env: {} })).resolves.toBe("");
  });

  test("warns in Git Bash (MSYSTEM set), where input cannot be hidden", async () => {
    const output = createFakeOutput();
    const stderr = createFakeOutput();
    const input = Readable.from([`${TOKEN}\n`]);

    await askHiddenQuestion(QUESTION, { input, output, stderr, env: { MSYSTEM: "MINGW64" } });

    expect(stderr.text()).toContain("cannot hide input");
    expect(stderr.text()).not.toContain(TOKEN);
  });

  test("does not warn when MSYSTEM is not set", async () => {
    const output = createFakeOutput();
    const stderr = createFakeOutput();
    const input = Readable.from([`${TOKEN}\n`]);

    await askHiddenQuestion(QUESTION, { input, output, stderr, env: {} });

    expect(stderr.write).not.toHaveBeenCalled();
  });
});
