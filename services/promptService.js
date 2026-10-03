const readline = require("readline");

const CTRL_C = "\u0003";
const CTRL_D = "\u0004";
const BACKSPACE = "\b";
const DELETE = "\u007f";
const ESC = "\u001b";

/*
  Ask a question without showing what the user types (for tokens).

  - Interactive terminal (Windows Terminal, PowerShell, cmd, macOS/Linux
    terminals): raw mode, nothing is echoed. Supports Backspace, paste,
    Enter, and Ctrl+C (rejects with code "PROMPT_CANCELLED").
  - Piped / non-TTY input (scripts, CI): reads the first line. There is no
    terminal to echo to, so nothing is shown.

  input/output default to process.stdin/process.stdout; tests pass fakes.
*/
function askHiddenQuestion(question, options = {}) {
  const input = options.input || process.stdin;
  const output = options.output || process.stdout;
  const env = options.env || process.env;
  const stderr = options.stderr || process.stderr;

  output.write(question);

  if (input.isTTY && typeof input.setRawMode === "function") {
    return readHiddenFromTerminal(input, output);
  }

  // Git Bash / mintty on Windows gives Node a pipe instead of a console,
  // so the terminal itself may echo what is typed.
  if (env.MSYSTEM) {
    stderr.write(
      "\nNote: this terminal cannot hide input. If you are typing the token, " +
        "use PowerShell/Windows Terminal, run `winpty node bin/secure-review.js gitlab login`, " +
        "or use `secure-review login --token \"$GITLAB_TOKEN\"`.\n"
    );
  }

  return readFirstLine(input);
}

function readHiddenFromTerminal(input, output) {
  return new Promise((resolve, reject) => {
    let value = "";
    let inEscapeSequence = false;
    const wasRaw = Boolean(input.isRaw);

    function cleanup() {
      input.removeListener("data", onData);
      input.setRawMode(wasRaw);
      input.pause();
      output.write("\n");
    }

    function onData(chunk) {
      for (const char of String(chunk)) {
        // Skip terminal escape sequences such as arrow keys (ESC [ A).
        if (inEscapeSequence) {
          if (/[A-Za-z~]/.test(char)) {
            inEscapeSequence = false;
          }
          continue;
        }

        if (char === ESC) {
          inEscapeSequence = true;
          continue;
        }

        if (char === "\r" || char === "\n") {
          cleanup();
          resolve(value);
          return;
        }

        if (char === CTRL_C) {
          cleanup();
          const error = new Error("Prompt cancelled.");
          error.code = "PROMPT_CANCELLED";
          reject(error);
          return;
        }

        if (char === CTRL_D) {
          if (value === "") {
            cleanup();
            resolve(value);
            return;
          }
          continue;
        }

        if (char === BACKSPACE || char === DELETE) {
          value = Array.from(value).slice(0, -1).join("");
          continue;
        }

        // Ignore other control characters.
        if (char < " ") {
          continue;
        }

        value += char;
      }
    }

    input.setRawMode(true);
    input.setEncoding("utf8");
    input.on("data", onData);
    input.resume();
  });
}

function readFirstLine(input) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input, terminal: false });
    let answered = false;

    rl.once("line", (line) => {
      answered = true;
      rl.close();
      resolve(line);
    });

    rl.once("close", () => {
      if (!answered) {
        resolve("");
      }
    });
  });
}

module.exports = {
  askHiddenQuestion,
};
