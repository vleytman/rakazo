import type { ConnectorTool } from "@rakazo/adapter-kit";
import { UI_NODE_TYPES, UiBlockSchema } from "@rakazo/contracts";
import { publishMessage } from "./run-messages.js";
import type { ToolHandlers } from "./run-tool-gate.js";

/** Read with {"help": true}; kept out of the always-listed description to save tokens. */
export const RENDER_UI_GUIDE = `# render_ui — interfaces in the chat

render_ui shows a small native interface in the chat, composed from nodes. Use it when the
answer is structured: comparisons, figures, plans, choices. Plain answers stay plain text.

Arguments: {"title"?: string, "root": <node>, "fallback": string}
- root: one node; use a stack to put several nodes together.
- fallback: the same content as short plain text (markdown table or list is fine). Shown on
  clients that cannot draw the interface and kept in history. Required.

Nodes ("type" picks the node):
- stack {children: node[], gap?: "sm"|"md"|"lg"} — vertical group (1–40 children)
- columns {children: node[]} — 2–4 side by side (stack on narrow screens)
- heading {text, level?: 1|2|3}
- text {text, tone?: "default"|"muted"} — plain text, blank line = new paragraph, **bold**
- callout {tone: "info"|"success"|"warning"|"danger", title?, text}
- divider {}
- stats {items: [{label, value, delta? (% change), hint?}]} — 1–12 KPI tiles
- table {columns?: [{key, label?, format?: "text"|"number"|"currency"|"percent"|"date"|"link", currency?: "USD"}], rows: [{...}]}
  — up to 200 rows; sortable; give columns with labels in the user's language
- chart {chart: "line"|"bar"|"area", x: string[], series: [{name, values: number[]}], unit?, title?}
  — line/area for time, bar for categories; up to 6 series
- choices {question?, options: [{label, hint?}], multiple?: bool, allowOther?: bool, submitLabel?}
  — the user picks and presses send; their answer arrives as their next message. After a
  choices node, end your turn and wait.
- buttons {buttons: [{label, message?, url?, variant?: "primary"|"secondary"}]} — one click sends
  message (or label) as the user's message, or opens url. End your turn after offering buttons.

Limits: 200 nodes, 6 levels deep, 200 KB.

Rules:
- Don't repeat what the interface shows in your text reply; add one or two sentences at most.
- Labels and text in the user's language.
- One render_ui per answer; compose several parts with a stack instead of several calls.

Example:
{"title": "Ноутбуки до $1000", "root": {"type": "stack", "children": [
  {"type": "stats", "items": [{"label": "Вариантов", "value": 3}, {"label": "Дешевле всего", "value": "$849"}]},
  {"type": "table", "columns": [{"key": "model", "label": "Модель"}, {"key": "price", "label": "Цена", "format": "currency", "currency": "USD"}],
   "rows": [{"model": "MacBook Air M4", "price": 999}, {"model": "Zenbook 14", "price": 849}]},
  {"type": "buttons", "buttons": [{"label": "Сравнить батарею", "message": "Сравни их по автономности"}]}
]}, "fallback": "Ноутбуки до $1000: MacBook Air M4 — $999; Zenbook 14 — $849."}
`;

export const RENDER_UI_TOOL: ConnectorTool = {
  name: "render_ui",
  description:
    `Show a native interface in the chat composed from nodes (${UI_NODE_TYPES.join(", ")}): KPI tiles, sortable tables, charts, callouts, ` +
    "one-click buttons and multiple-choice questions. Use it for structured answers instead of long markdown. " +
    'Call {"help": true} once first to read the node reference.',
  inputSchema: {
    type: "object",
    properties: {
      help: { type: "boolean", description: "Return the node reference instead of rendering." },
      title: { type: "string", description: "Short title of the interface." },
      root: {
        type: "object",
        description:
          'The interface: one node, usually {"type": "stack", "children": [...]}. See {"help": true} for every node.',
      },
      fallback: {
        type: "string",
        description: "The same content as short plain text, for clients that cannot draw it.",
      },
    },
  },
};

export const uiTools: ToolHandlers = {
  async render_ui(ctx, call) {
    const { deps, run } = ctx;
    const { args } = call;
    if (args.help === true) return call.finish({ guide: RENDER_UI_GUIDE });
    const parsed = UiBlockSchema.safeParse({
      kind: "ui",
      ...(typeof args.title === "string" && args.title ? { title: args.title } : {}),
      root: args.root,
      fallback: typeof args.fallback === "string" ? args.fallback : "",
    });
    if (!parsed.success) {
      return call.finish({
        error: "The interface is not valid; nothing was shown.",
        issues: parsed.error.issues
          .slice(0, 12)
          .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`),
        hint: 'Call render_ui with {"help": true} for the node reference.',
      });
    }
    if (!parsed.data.fallback.trim()) {
      return call.finish({ error: "fallback is required: the same content as short plain text." });
    }
    // The text block right after the ui block carries the fallback for clients without ui
    // support; the web app hides it next to the interface it repeats.
    await publishMessage(deps, run, "bot", [
      parsed.data,
      { kind: "text", text: parsed.data.fallback },
    ]);
    return call.finish({
      ok: true,
      shown: true,
      note: "Shown in the chat. Don't repeat its contents in your reply.",
    });
  },
};
