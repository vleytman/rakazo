import { useLingui } from "@lingui/react/macro";
import { useExternalLinkOpener } from "@rakazo/chat-ui/web";
import type { UiBlock, UiNode } from "@rakazo/contracts";
import { Button, cn } from "@rakazo/ui-web";
import {
  ArrowDown,
  ArrowUp,
  Check,
  CircleAlert,
  CircleCheck,
  Info,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtifactTarget } from "../../lib/artifact-open";
import { rpc } from "../../lib/rpc";
import { errorText } from "../../lib/user-error";

/**
 * A bot's render_ui interface, drawn natively in the message: no frame, the app's own type,
 * colours and theme. Buttons and choices send the user's answer as their next message.
 */
export function UiBlockView({ block, target }: { block: UiBlock; target: ArtifactTarget }) {
  const { open, dialog } = useExternalLinkOpener();
  const [sentError, setSentError] = useState<string | null>(null);
  const send = async (text: string) => {
    setSentError(null);
    try {
      await rpc.threads.send({ ...target, clientNonce: crypto.randomUUID(), text });
      return true;
    } catch (error) {
      setSentError(errorText(error, "Could not send"));
      return false;
    }
  };
  return (
    <div
      className="w-[960px] max-w-full rounded-2xl border border-border bg-card px-5 py-4"
      data-testid="ui-block"
    >
      {block.title ? (
        <div className="mb-3 text-body-lg font-semibold text-foreground" dir="auto">
          {block.title}
        </div>
      ) : null}
      <Node node={block.root} ctx={{ send, open }} />
      {sentError ? <p className="mt-2 text-body-sm text-destructive">{sentError}</p> : null}
      {dialog}
    </div>
  );
}

type Ctx = { send: (text: string) => Promise<boolean>; open: (url: string) => void };

function Node({ node, ctx }: { node: UiNode; ctx: Ctx }): ReactNode {
  switch (node.type) {
    case "stack":
      return (
        <div
          className={cn(
            "flex min-w-0 flex-col",
            node.gap === "sm" ? "gap-2" : node.gap === "lg" ? "gap-6" : "gap-4",
          )}
        >
          {node.children.map((child, i) => (
            <Node key={i} node={child} ctx={ctx} />
          ))}
        </div>
      );
    case "columns":
      return (
        <div
          className="grid min-w-0 gap-4"
          style={{ gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, 220px), 1fr))` }}
        >
          {node.children.map((child, i) => (
            <div key={i} className="min-w-0">
              <Node node={child} ctx={ctx} />
            </div>
          ))}
        </div>
      );
    case "heading":
      return (
        <div
          dir="auto"
          className={cn(
            "font-semibold text-foreground",
            node.level === 1 ? "text-heading3" : node.level === 3 ? "text-body" : "text-body-lg",
          )}
        >
          {node.text}
        </div>
      );
    case "text":
      return (
        <div
          dir="auto"
          className={cn(
            "space-y-2 text-body-lg leading-[1.5]",
            node.tone === "muted" ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {node.text.split(/\n{2,}/).map((para, i) => (
            <p key={i} className="whitespace-pre-line">
              <Bold text={para} />
            </p>
          ))}
        </div>
      );
    case "callout":
      return <Callout node={node} />;
    case "divider":
      return <hr className="border-border" />;
    case "stats":
      return <Stats node={node} />;
    case "table":
      return <Table node={node} open={ctx.open} />;
    case "chart":
      return <Chart node={node} />;
    case "choices":
      return <Choices node={node} send={ctx.send} />;
    case "buttons":
      return <Buttons node={node} ctx={ctx} />;
    default:
      return null;
  }
}

function Bold({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") && part.length > 4 ? (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  );
}

const CALLOUT = {
  info: { icon: Info, box: "bg-foreground/[0.045]", ink: "text-foreground" },
  success: { icon: CircleCheck, box: "bg-success/10", ink: "text-success" },
  warning: { icon: TriangleAlert, box: "bg-warning/12", ink: "text-warning" },
  danger: { icon: CircleAlert, box: "bg-destructive/10", ink: "text-destructive" },
} as const;

function Callout({ node }: { node: Extract<UiNode, { type: "callout" }> }) {
  const style = CALLOUT[node.tone ?? "info"];
  const Icon = style.icon;
  return (
    <div className={cn("flex gap-3 rounded-xl px-4 py-3", style.box)} dir="auto">
      <Icon className={cn("mt-0.5 size-4 shrink-0", style.ink)} aria-hidden="true" />
      <div className="min-w-0 text-body">
        {node.title ? <div className={cn("font-semibold", style.ink)}>{node.title}</div> : null}
        <div className="whitespace-pre-line text-foreground">
          <Bold text={node.text} />
        </div>
      </div>
    </div>
  );
}

function useNumber() {
  const { i18n } = useLingui();
  return useMemo(() => {
    const plain = new Intl.NumberFormat(i18n.locale, { maximumFractionDigits: 2 });
    const compact = new Intl.NumberFormat(i18n.locale, {
      notation: "compact",
      maximumFractionDigits: 1,
    });
    return (value: number) => (Math.abs(value) >= 100_000 ? compact : plain).format(value);
  }, [i18n.locale]);
}

function Stats({ node }: { node: Extract<UiNode, { type: "stats" }> }) {
  const num = useNumber();
  return (
    <div
      className="grid gap-2.5"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))" }}
    >
      {node.items.map((item, i) => (
        <div key={i} className="rounded-xl bg-foreground/[0.045] px-4 py-3" dir="auto">
          <div className="text-body-sm text-muted-foreground">{item.label}</div>
          <div className="mt-0.5 text-heading2 font-semibold tracking-tight text-foreground tabular-nums">
            {typeof item.value === "number" ? num(item.value) : item.value}
          </div>
          {typeof item.delta === "number" ? (
            <div
              className={cn(
                "flex items-center gap-0.5 text-body-sm font-medium tabular-nums",
                item.delta >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {item.delta >= 0 ? (
                <ArrowUp className="size-3.5" />
              ) : (
                <ArrowDown className="size-3.5" />
              )}
              {num(Math.abs(item.delta))}%
            </div>
          ) : null}
          {item.hint ? <div className="text-body-sm text-muted-foreground">{item.hint}</div> : null}
        </div>
      ))}
    </div>
  );
}

type TableColumn = NonNullable<Extract<UiNode, { type: "table" }>["columns"]>[number];

const pretty = (key: string) => {
  const text = key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function Table({
  node,
  open,
}: {
  node: Extract<UiNode, { type: "table" }>;
  open: (url: string) => void;
}) {
  const { i18n } = useLingui();
  const num = useNumber();
  const columns = useMemo<TableColumn[]>(
    () => node.columns ?? Object.keys(node.rows[0] ?? {}).map((key) => ({ key })),
    [node],
  );
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const rows = useMemo(() => {
    if (!sort) return node.rows;
    return [...node.rows].sort((a, b) => {
      const x = a[sort.key];
      const y = b[sort.key];
      if (x == null) return 1;
      if (y == null) return -1;
      return (
        (typeof x === "number" && typeof y === "number"
          ? x - y
          : String(x).localeCompare(String(y), i18n.locale, { numeric: true })) * sort.dir
      );
    });
  }, [node.rows, sort, i18n.locale]);
  const numeric = (key: string, format?: string) =>
    format === "number" ||
    format === "currency" ||
    format === "percent" ||
    (!format && node.rows.every((row) => row[key] == null || typeof row[key] === "number"));
  const cell = (value: unknown, column: TableColumn) => {
    if (value == null || value === "") return <span className="text-muted-foreground">—</span>;
    const format = column.format;
    if (typeof value === "number") {
      if (format === "currency")
        return new Intl.NumberFormat(i18n.locale, {
          style: "currency",
          currency: column.currency || "USD",
          minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(value);
      if (format === "percent") return `${num(value)}%`;
      return num(value);
    }
    if (typeof value === "boolean") return value ? <Check className="size-4" /> : "—";
    const text = String(value);
    if (format === "link" || /^https?:\/\//.test(text)) {
      return (
        <button
          type="button"
          className="text-left text-primary underline-offset-2 hover:underline"
          onClick={() => open(text)}
        >
          {text.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}
        </button>
      );
    }
    if (format === "date") {
      const date = new Date(text);
      if (!Number.isNaN(date.getTime()))
        return date.toLocaleDateString(i18n.locale, {
          day: "numeric",
          month: "short",
          year: "numeric",
        });
    }
    return text;
  };
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full border-collapse text-body tabular-nums">
        <thead>
          <tr className="bg-foreground/[0.035]">
            {columns.map((column) => {
              const right = numeric(column.key, column.format);
              const active = sort?.key === column.key;
              return (
                <th
                  key={column.key}
                  className={cn(
                    "cursor-pointer select-none whitespace-nowrap px-3 py-2 text-body-sm font-medium text-muted-foreground",
                    right ? "text-right" : "text-left",
                  )}
                  onClick={() =>
                    setSort(
                      active && sort?.dir === 1
                        ? { key: column.key, dir: -1 }
                        : active
                          ? null
                          : { key: column.key, dir: 1 },
                    )
                  }
                >
                  {column.label || pretty(column.key)}
                  {active ? (sort?.dir === 1 ? " ↑" : " ↓") : null}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="border-t border-border">
              {columns.map((column, c) => {
                const right = numeric(column.key, column.format);
                return (
                  <td
                    key={column.key}
                    dir="auto"
                    className={cn(
                      "px-3 py-2 align-top text-foreground",
                      right ? "whitespace-nowrap text-right" : "break-words",
                      c === 0 && "font-medium",
                    )}
                  >
                    {cell(row[column.key], column)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new ResizeObserver(() => setWidth(Math.round(element.clientWidth)));
    observer.observe(element);
    setWidth(Math.round(element.clientWidth));
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

const SERIES = ["#4f7cff", "#f2a93b", "#2bb3a3", "#e5677d", "#8b6cf0", "#7a8a99"];

function ticks(min: number, max: number, count = 4) {
  let lo = min;
  let hi = max;
  if (lo === hi) hi = lo + 1;
  const raw = (hi - lo) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step =
    [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => (hi - lo) / s <= count) ?? 10 * mag;
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return out;
}

function Chart({ node }: { node: Extract<UiNode, { type: "chart" }> }) {
  const num = useNumber();
  const [hover, setHover] = useState<number | null>(null);
  const [box, width] = useWidth();
  const W = Math.max(280, width || 720);
  const H = W < 480 ? 200 : 240;
  const L = 48;
  const R = 12;
  const T = 10;
  const B = 28;
  const values = node.series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const kind = node.chart ?? "line";
  let min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  // Bars and areas stand on zero; a line shows its own range.
  if (kind !== "line") min = Math.min(0, min);
  const axis = ticks(min, max);
  const y0 = axis[0] ?? 0;
  const y1 = axis[axis.length - 1] ?? 1;
  const n = node.x.length;
  const band = (W - L - R) / Math.max(n, 1);
  const xAt = (i: number) => L + band * i + band / 2;
  const yAt = (v: number) => T + (H - T - B) * (1 - (v - y0) / (y1 - y0 || 1));
  const every = Math.ceil(n / Math.max(1, Math.floor((W - L - R) / 72)));
  const unit = node.unit;
  const fmt = (v: number | null | undefined) =>
    v == null
      ? "—"
      : unit && /^[$€₪£]$/.test(unit)
        ? `${unit}${num(v)}`
        : `${num(v)}${unit ? ` ${unit}` : ""}`;
  const svg = useRef<SVGSVGElement>(null);
  return (
    <div className="min-w-0">
      {node.title ? (
        <div className="mb-1 text-body font-medium text-foreground">{node.title}</div>
      ) : null}
      {node.series.length > 1 ? (
        <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-body-sm text-muted-foreground">
          {node.series.map((s, i) => (
            <span key={s.name} className="flex items-center gap-1.5">
              <i
                className="inline-block size-2.5 rounded-sm"
                style={{ background: SERIES[i % 6] }}
              />
              {s.name}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={box} className="relative">
        <svg
          ref={svg}
          viewBox={`0 0 ${W} ${H}`}
          className="block h-auto w-full overflow-visible"
          role="img"
          aria-label={node.title ?? "chart"}
          onPointerMove={(event) => {
            const box = svg.current?.getBoundingClientRect();
            if (!box) return;
            const px = ((event.clientX - box.left) / box.width) * W;
            setHover(Math.min(n - 1, Math.max(0, Math.floor((px - L) / band))));
          }}
          onPointerLeave={() => setHover(null)}
        >
          {axis.map((t) => (
            <g key={t}>
              <line
                x1={L}
                x2={W - R}
                y1={yAt(t)}
                y2={yAt(t)}
                className="stroke-border"
                strokeWidth={t === 0 ? 1.4 : 1}
              />
              <text
                x={L - 6}
                y={yAt(t) + 4}
                textAnchor="end"
                className="fill-muted-foreground text-[11px]"
              >
                {num(t)}
              </text>
            </g>
          ))}
          {node.x.map((label, i) =>
            i % every ? null : (
              <text
                key={i}
                x={xAt(i)}
                y={H - 8}
                textAnchor="middle"
                className="fill-muted-foreground text-[11px]"
              >
                {label.length > 12 ? `${label.slice(0, 11)}…` : label}
              </text>
            ),
          )}
          {kind === "bar"
            ? node.series.map((s, si) => {
                const group = band * 0.72;
                const width = group / node.series.length;
                return s.values.map((v, i) =>
                  v == null ? null : (
                    <rect
                      key={`${si}-${i}`}
                      x={xAt(i) - group / 2 + width * si + 1}
                      y={Math.min(yAt(v), yAt(0))}
                      width={Math.max(1, width - 2)}
                      height={Math.max(1, Math.abs(yAt(v) - yAt(0)))}
                      rx={Math.min(3, width / 4)}
                      fill={SERIES[si % 6]}
                      opacity={hover === null || hover === i ? 1 : 0.55}
                    />
                  ),
                );
              })
            : node.series.map((s, si) => {
                let d = "";
                let pen = false;
                s.values.forEach((v, i) => {
                  if (v == null) {
                    pen = false;
                    return;
                  }
                  d += `${pen ? "L" : "M"}${xAt(i)},${yAt(v)}`;
                  pen = true;
                });
                const first = s.values.findIndex((v) => v != null);
                const last =
                  s.values.length - 1 - [...s.values].reverse().findIndex((v) => v != null);
                return (
                  <g key={s.name}>
                    {kind === "area" && first >= 0 ? (
                      <path
                        d={`${d}L${xAt(last)},${yAt(Math.max(y0, 0))}L${xAt(first)},${yAt(Math.max(y0, 0))}Z`}
                        fill={SERIES[si % 6]}
                        opacity={0.14}
                      />
                    ) : null}
                    <path
                      d={d}
                      fill="none"
                      stroke={SERIES[si % 6]}
                      strokeWidth={2}
                      strokeLinejoin="round"
                      strokeLinecap="round"
                    />
                    {n <= 40
                      ? s.values.map((v, i) =>
                          v == null ? null : (
                            <circle key={i} cx={xAt(i)} cy={yAt(v)} r={2.6} fill={SERIES[si % 6]} />
                          ),
                        )
                      : null}
                  </g>
                );
              })}
          {hover !== null && kind !== "bar" ? (
            <line
              x1={xAt(hover)}
              x2={xAt(hover)}
              y1={T}
              y2={H - B}
              className="stroke-muted-foreground"
              strokeDasharray="3 3"
            />
          ) : null}
        </svg>
        {hover !== null ? (
          <div
            className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 rounded-lg bg-foreground px-2.5 py-1.5 text-body-sm text-background tabular-nums shadow"
            style={{ left: `${(xAt(hover) / W) * 100}%` }}
          >
            <div className="font-semibold">{node.x[hover]}</div>
            {node.series.map((s) => (
              <div key={s.name}>
                {node.series.length > 1 ? `${s.name}: ` : ""}
                {fmt(s.values[hover])}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Choices({
  node,
  send,
}: {
  node: Extract<UiNode, { type: "choices" }>;
  send: (text: string) => Promise<boolean>;
}) {
  const { t } = useLingui();
  const [picked, setPicked] = useState<number[]>([]);
  const [other, setOther] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const multiple = node.multiple ?? false;
  const toggle = (i: number) => {
    if (state !== "idle") return;
    setPicked((current) =>
      multiple ? (current.includes(i) ? current.filter((x) => x !== i) : [...current, i]) : [i],
    );
  };
  const ready = picked.length > 0 || other.trim().length > 0;
  const submit = async () => {
    if (!ready || state !== "idle") return;
    const labels = [...picked].sort((a, b) => a - b).map((i) => node.options[i]?.label ?? "");
    const own = other.trim();
    const parts: string[] = [];
    if (labels.length) parts.push(labels.join("; "));
    if (own) parts.push(labels.length ? `${t`own answer`}: ${own}` : own);
    const answer = parts.join("; ");
    setState("sending");
    setState((await send(answer)) ? "sent" : "idle");
  };
  return (
    <div className="space-y-2">
      {node.question ? (
        <div className="text-body-lg font-medium text-foreground" dir="auto">
          {node.question}
        </div>
      ) : null}
      <div className="grid gap-1.5" role={multiple ? "group" : "radiogroup"}>
        {node.options.map((option, i) => {
          const on = picked.includes(i);
          return (
            // biome-ignore lint/a11y/useAriaPropsSupportedByRole: role is checkbox or radio, both take aria-checked
            <button
              key={i}
              type="button"
              role={multiple ? "checkbox" : "radio"}
              aria-checked={on}
              disabled={state !== "idle"}
              onClick={() => toggle(i)}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3.5 py-2.5 text-left transition-colors",
                on
                  ? "border-primary bg-primary/8"
                  : "border-border hover:border-muted-foreground/50",
                state !== "idle" && !on && "opacity-50",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center border",
                  multiple ? "rounded-[5px]" : "rounded-full",
                  on
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/50",
                )}
              >
                {on ? (
                  multiple ? (
                    <Check className="size-3" strokeWidth={3} />
                  ) : (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  )
                ) : null}
              </span>
              <span className="min-w-0" dir="auto">
                <span className="block text-body text-foreground">{option.label}</span>
                {option.hint ? (
                  <span className="block text-body-sm text-muted-foreground">{option.hint}</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      {node.allowOther ? (
        <input
          value={other}
          disabled={state !== "idle"}
          onChange={(event) => setOther(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submit();
          }}
          placeholder={node.otherPlaceholder ?? t`Your own answer…`}
          className="w-full rounded-xl border border-border bg-transparent px-3.5 py-2.5 text-body text-foreground outline-none focus:border-primary"
        />
      ) : null}
      <div className="flex items-center gap-3 pt-1">
        <Button size="sm" disabled={!ready || state !== "idle"} onClick={() => void submit()}>
          {state === "sent" ? <Check className="size-4" /> : null}
          {state === "sent" ? t`Sent` : (node.submitLabel ?? t`Send`)}
        </Button>
        {multiple && picked.length && state === "idle" ? (
          <span className="text-body-sm text-muted-foreground">{t`Selected: ${picked.length}`}</span>
        ) : null}
      </div>
    </div>
  );
}

function Buttons({ node, ctx }: { node: Extract<UiNode, { type: "buttons" }>; ctx: Ctx }) {
  const [used, setUsed] = useState<number | null>(null);
  return (
    <div className="flex flex-wrap gap-2">
      {node.buttons.map((button, i) => (
        <Button
          key={i}
          size="sm"
          variant={
            button.variant === "primary" || (!button.variant && i === 0) ? "default" : "outline"
          }
          disabled={!button.url && used !== null}
          onClick={async () => {
            if (button.url) return ctx.open(button.url);
            setUsed(i);
            if (!(await ctx.send(button.message ?? button.label))) setUsed(null);
          }}
        >
          {used === i ? <Check className="size-4" /> : null}
          {button.label}
        </Button>
      ))}
    </div>
  );
}

/** Drops the fallback text render_ui publishes after its interface; other clients show it instead. */
export function withoutUiFallbacks<T extends { kind: string }>(blocks: T[]): T[] {
  return blocks.filter((block, i) => {
    const before = blocks[i - 1] as { kind: string; fallback?: unknown } | undefined;
    return !(
      block.kind === "text" &&
      before?.kind === "ui" &&
      (block as { kind: string; text?: unknown }).text === before.fallback
    );
  });
}
