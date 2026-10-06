/*
  Renders the pre-recorded Gemini explanations (Markdown) as HTML.

  Gemini output is untrusted text, so:
    1. marked turns Markdown into an HTML string, with raw HTML in the
       source escaped (shown as text, never parsed as markup);
    2. DOMPurify sanitizes that string against a small allow-list and returns
       DOM nodes directly (RETURN_DOM_FRAGMENT), so no HTML string is ever
       assigned to the DOM as markup.
  If DOMPurify cannot run in this browser, the text is shown as plain text.
*/
import { Marked } from "marked";
import createDOMPurify from "dompurify";

const ALLOWED_TAGS = [
  "h4", "h5", "h6", "p", "br", "hr", "strong", "em", "del", "code", "pre",
  "ul", "ol", "li", "blockquote", "a", "table", "thead", "tbody", "tr", "th", "td",
];
const ALLOWED_ATTR = ["href", "title", "start", "align"];

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const markdown = new Marked({ gfm: true, async: false });

markdown.use({
  renderer: {
    // Raw HTML blocks and inline tags in the recorded text stay visible text.
    html({ text }) {
      return escapeHtml(text);
    },
    // Each explanation sits under an <h3>, so its headings start at <h4>.
    heading({ tokens, depth }) {
      const level = Math.min(6, Math.max(4, depth + 1));
      return `<h${level}>${this.parser.parseInline(tokens)}</h${level}>\n`;
    },
    // Images could load from anywhere; show their alt text instead.
    image({ text }) {
      return escapeHtml(text);
    },
  },
});

let purifier = null;

function getPurifier(window) {
  if (!purifier || purifier.window !== window) {
    const instance = createDOMPurify(window);

    // Links open outside the demo and never tell the target where they came from.
    instance.addHook("afterSanitizeAttributes", (node) => {
      if (node.tagName === "A") {
        node.setAttribute("rel", "noopener noreferrer nofollow");
        node.setAttribute("target", "_blank");
      }
    });

    purifier = { window, instance };
  }

  return purifier.instance;
}

// Markdown -> HTML string. Not sanitized: only pass the result to sanitize().
export function markdownToHtml(text) {
  return markdown.parse(String(text || ""));
}

// Markdown -> sanitized DocumentFragment for `window`'s document.
export function renderMarkdown(text, window = globalThis.window) {
  const purify = getPurifier(window);

  if (!purify.isSupported) {
    const fallback = window.document.createDocumentFragment();
    const p = window.document.createElement("p");
    p.className = "plain-text";
    p.textContent = String(text || "");
    fallback.appendChild(p);
    return fallback;
  }

  return purify.sanitize(markdownToHtml(text), {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|#)/i,
    RETURN_DOM_FRAGMENT: true,
  });
}
