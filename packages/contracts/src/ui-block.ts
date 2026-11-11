import * as z from "zod";

/**
 * Generative UI in chat: a bot composes a small interface from these nodes with the render_ui
 * tool, and the web app draws it natively (no iframe). Clients that don't know the "ui" block
 * show the text block render_ui publishes right after it, which holds `fallback`.
 */

export const UI_BLOCK_MAX_NODES = 200;
export const UI_BLOCK_MAX_DEPTH = 6;
export const UI_BLOCK_MAX_BYTES = 200_000;
export const UI_TABLE_MAX_ROWS = 200;

const Text = z.string().max(4_000);
const Short = z.string().min(1).max(200);
const Cell = z.union([z.string().max(2_000), z.number(), z.boolean(), z.null()]);

const Heading = z.object({
  type: z.literal("heading"),
  text: Short,
  level: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
});

const Paragraph = z.object({
  type: z.literal("text"),
  /** Plain text; blank lines separate paragraphs, **bold** is shown bold. */
  text: Text,
  tone: z.enum(["default", "muted"]).optional(),
});

const Callout = z.object({
  type: z.literal("callout"),
  tone: z.enum(["info", "success", "warning", "danger"]).default("info"),
  title: Short.optional(),
  text: Text,
});

const Divider = z.object({ type: z.literal("divider") });

const Stats = z.object({
  type: z.literal("stats"),
  items: z
    .array(
      z.object({
        label: Short,
        value: z.union([z.string().max(60), z.number()]),
        /** Change vs the previous period, in percent. */
        delta: z.number().optional(),
        hint: z.string().max(120).optional(),
      }),
    )
    .min(1)
    .max(12),
});

const Table = z.object({
  type: z.literal("table"),
  columns: z
    .array(
      z.object({
        key: Short,
        label: Short.optional(),
        format: z.enum(["text", "number", "currency", "percent", "date", "link"]).optional(),
        currency: z.string().length(3).optional(),
      }),
    )
    .max(16)
    .optional(),
  rows: z.array(z.record(z.string(), Cell)).max(UI_TABLE_MAX_ROWS),
});

const Chart = z.object({
  type: z.literal("chart"),
  chart: z.enum(["line", "bar", "area"]).default("line"),
  /** X-axis labels (dates or categories), one per value. */
  x: z.array(z.string().max(60)).min(1).max(400),
  series: z
    .array(z.object({ name: Short, values: z.array(z.number().nullable()).max(400) }))
    .min(1)
    .max(6),
  unit: z.string().max(12).optional(),
  title: Short.optional(),
});

const Choices = z.object({
  type: z.literal("choices"),
  question: z.string().max(300).optional(),
  options: z
    .array(z.object({ label: z.string().min(1).max(120), hint: z.string().max(200).optional() }))
    .min(2)
    .max(16),
  multiple: z.boolean().default(false),
  allowOther: z.boolean().default(false),
  submitLabel: z.string().max(40).optional(),
  otherPlaceholder: z.string().max(80).optional(),
});

const Buttons = z.object({
  type: z.literal("buttons"),
  buttons: z
    .array(
      z.object({
        label: z.string().min(1).max(60),
        /** Sent to the bot as the user's message on click; defaults to the label. */
        message: z.string().max(1_000).optional(),
        /** Opens a link instead of sending a message. */
        url: z.url({ protocol: /^https?$/ }).optional(),
        variant: z.enum(["primary", "secondary"]).optional(),
      }),
    )
    .min(1)
    .max(6),
});

export type UiNode =
  | z.infer<typeof Heading>
  | z.infer<typeof Paragraph>
  | z.infer<typeof Callout>
  | z.infer<typeof Divider>
  | z.infer<typeof Stats>
  | z.infer<typeof Table>
  | z.infer<typeof Chart>
  | z.infer<typeof Choices>
  | z.infer<typeof Buttons>
  | { type: "stack"; gap?: "sm" | "md" | "lg"; children: UiNode[] }
  | { type: "columns"; children: UiNode[] };

const Stack = z.object({
  type: z.literal("stack"),
  gap: z.enum(["sm", "md", "lg"]).optional(),
  get children() {
    return z.array(UiNodeSchema).min(1).max(40);
  },
});

const Columns = z.object({
  type: z.literal("columns"),
  get children() {
    return z.array(UiNodeSchema).min(2).max(4);
  },
});

export const UiNodeSchema: z.ZodType<UiNode> = z.discriminatedUnion("type", [
  Stack,
  Columns,
  Heading,
  Paragraph,
  Callout,
  Divider,
  Stats,
  Table,
  Chart,
  Choices,
  Buttons,
]) as unknown as z.ZodType<UiNode>;

export const UI_NODE_TYPES = [
  "stack",
  "columns",
  "heading",
  "text",
  "callout",
  "divider",
  "stats",
  "table",
  "chart",
  "choices",
  "buttons",
] as const;

/** Node count and nesting depth, for the limits. */
export function uiTreeSize(node: UiNode, depth = 1): { nodes: number; depth: number } {
  if (node.type !== "stack" && node.type !== "columns") return { nodes: 1, depth };
  let nodes = 1;
  let deepest = depth;
  for (const child of node.children) {
    const size = uiTreeSize(child, depth + 1);
    nodes += size.nodes;
    deepest = Math.max(deepest, size.depth);
  }
  return { nodes, depth: deepest };
}

export const UiBlockSchema = z
  .object({
    kind: z.literal("ui"),
    title: z.string().max(200).optional(),
    root: UiNodeSchema,
    /** Plain-text version for clients without the ui block, notifications and history. */
    fallback: z.string().max(8_000),
  })
  .superRefine((block, ctx) => {
    const size = uiTreeSize(block.root);
    if (size.nodes > UI_BLOCK_MAX_NODES)
      ctx.addIssue({
        code: "custom",
        message: `UI has ${size.nodes} nodes; the limit is ${UI_BLOCK_MAX_NODES}`,
      });
    if (size.depth > UI_BLOCK_MAX_DEPTH)
      ctx.addIssue({
        code: "custom",
        message: `UI nests ${size.depth} levels; the limit is ${UI_BLOCK_MAX_DEPTH}`,
      });
    if (JSON.stringify(block).length > UI_BLOCK_MAX_BYTES)
      ctx.addIssue({ code: "custom", message: `UI is larger than ${UI_BLOCK_MAX_BYTES} bytes` });
  });

export type UiBlock = z.infer<typeof UiBlockSchema>;
