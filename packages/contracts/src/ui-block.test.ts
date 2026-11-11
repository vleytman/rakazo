import { describe, expect, it } from "vitest";
import { MessageBlock } from "./events.js";
import type { UiNode } from "./ui-block.js";
import { UiBlockSchema, uiTreeSize } from "./ui-block.js";

const table: UiNode = { type: "table", rows: [{ model: "Air", price: 999 }] };

describe("ui block", () => {
  it("accepts a composed interface as a message block", () => {
    const block = {
      kind: "ui",
      title: "Laptops",
      fallback: "Air — $999",
      root: {
        type: "stack",
        children: [
          { type: "stats", items: [{ label: "Options", value: 1 }] },
          { type: "columns", children: [table, { type: "text", text: "**Cheap** enough" }] },
          { type: "choices", options: [{ label: "A" }, { label: "B" }], multiple: true },
          { type: "buttons", buttons: [{ label: "More", message: "Tell me more" }] },
        ],
      },
    };
    expect(MessageBlock.safeParse(block).success).toBe(true);
    expect(uiTreeSize(block.root as UiNode)).toEqual({ nodes: 7, depth: 3 });
  });

  it("refuses unknown nodes, deep nesting and javascript links", () => {
    const base = { kind: "ui", fallback: "x" };
    expect(UiBlockSchema.safeParse({ ...base, root: { type: "script", text: "x" } }).success).toBe(
      false,
    );
    let deep: UiNode = table;
    for (let i = 0; i < 7; i++) deep = { type: "stack", children: [deep] };
    expect(UiBlockSchema.safeParse({ ...base, root: deep }).success).toBe(false);
    expect(
      UiBlockSchema.safeParse({
        ...base,
        root: { type: "buttons", buttons: [{ label: "x", url: "javascript:alert(1)" }] },
      }).success,
    ).toBe(false);
  });
});
