import { useLingui } from "@lingui/react/macro";
import { useExternalLinkOpener } from "@rakazo/chat-ui/web";
import type { MessageBlock } from "@rakazo/contracts";
import { MCP_APP_VIEWER_PATH } from "@rakazo/contracts/content-security-policy";
import type { McpAppDisplayMode } from "@rakazo/core";
import { createMcpAppHost, mcpAppCsp, mcpAppDocument } from "@rakazo/core";
import { Button, cn, Dialog, DialogClose, DialogContent, DialogTitle } from "@rakazo/ui-web";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ArtifactTarget } from "../lib/artifact-open";
import { fetchArtifactBytes } from "../lib/artifact-open";
import { composerDraftKey, offerComposerText } from "../lib/composer-draft";
import { useAppTheme, useMedia } from "../lib/pages";

type AppBlock = Extract<MessageBlock, { kind: "app" }>;

const MIN_HEIGHT = 80;
export const MCP_APP_MAX_HEIGHT = 640;
/** The expanded view is a dialog over the whole app, at most this share of the window's height. */
const EXPANDED_MAX_VH = 0.75;
/** An app that has not started by then is not shown; the bot's reply stands without it. */
const START_TIMEOUT_MS = 15_000;

async function fetchAppHtml(target: ArtifactTarget, artifactId: string): Promise<string> {
  return new TextDecoder().decode(await fetchArtifactBytes(target, artifactId));
}

function useWindowHeight() {
  const [height, setHeight] = useState(() => window.innerHeight);
  useEffect(() => {
    const onResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  return height;
}

/**
 * An MCP server's app for one tool call, drawn in the sandboxed shell at MCP_APP_VIEWER_PATH:
 * opaque origin, no app cookies or storage, and only the domains it declared that this host
 * allows. It gets the call's arguments and result and can ask for three things: open a link
 * (through the usual confirm) and put text in the composer, each right after the person clicked
 * or typed in it, and switch to fullscreen, which opens a second session of the same app in a
 * dialog over the whole app. It cannot call tools.
 */
export function McpAppCard({ block, target }: { block: AppBlock; target: ArtifactTarget }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const windowHeight = useWindowHeight();
  const html = useQuery({
    queryKey: ["mcp-app-html", block.artifactId],
    queryFn: () => fetchAppHtml(target, block.artifactId),
    enabled: near,
    staleTime: Number.POSITIVE_INFINITY,
  });
  const excludeHosts = useMemo(() => [window.location.hostname], []);
  // A refetched message is a new object with the same values; the app's session must outlive it.
  const cspKey = JSON.stringify(block.csp ?? {});
  const csp = useMemo(() => mcpAppCsp(JSON.parse(cspKey), excludeHosts), [cspKey, excludeHosts]);
  const appDocument = useMemo(
    () => (html.data === undefined ? null : mcpAppDocument(html.data, csp, excludeHosts)),
    [html.data, csp, excludeHosts],
  );

  // Drawn only near the screen: a long chat of apps should not run them all at once.
  useEffect(() => {
    const element = box.current;
    if (!element || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          observer.disconnect();
        }
      },
      { rootMargin: "480px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  if (html.isError || failed) return null;
  const bordered = block.prefersBorder !== false;
  const expandedMax = Math.round(windowHeight * EXPANDED_MAX_VH);
  return (
    <div ref={box} className="w-[960px] max-w-full" data-testid="mcp-app">
      <div className="mb-1.5 px-1 text-label text-muted-foreground" dir="auto">
        {block.server}
      </div>
      <div
        className={cn("overflow-hidden", bordered && "rounded-2xl border border-border bg-card")}
      >
        {appDocument ? (
          <McpAppFrame
            block={block}
            target={target}
            appDocument={appDocument}
            csp={csp}
            mode="inline"
            maxHeight={MCP_APP_MAX_HEIGHT}
            onDisplayMode={(next) => setExpanded(next === "fullscreen")}
            onFailed={() => setFailed(true)}
          />
        ) : (
          <div style={{ height: MIN_HEIGHT * 2 }} />
        )}
      </div>
      {appDocument ? (
        <Dialog open={expanded} onOpenChange={setExpanded}>
          <DialogContent
            showCloseButton={false}
            className="flex max-h-[75vh] w-[min(1200px,94vw)] flex-col gap-0 overflow-hidden p-0 sm:max-w-none"
          >
            <header className="flex h-12 shrink-0 items-center gap-1 border-b border-border px-4">
              <DialogTitle className="min-w-0 flex-1 truncate text-body font-medium text-muted-foreground">
                {block.server}
              </DialogTitle>
              <DialogClose
                aria-label="Close"
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="rounded-full text-muted-foreground"
                  />
                }
              >
                <X />
              </DialogClose>
            </header>
            <div className="min-h-0 flex-1 overflow-auto">
              <McpAppFrame
                block={block}
                target={target}
                appDocument={appDocument}
                csp={csp}
                mode="fullscreen"
                maxHeight={expandedMax - 48}
                onDisplayMode={(next) => setExpanded(next === "fullscreen")}
              />
            </div>
          </DialogContent>
        </Dialog>
      ) : null}
    </div>
  );
}

/** One session of the app in one frame. The card and its expanded dialog each run their own. */
function McpAppFrame({
  block,
  target,
  appDocument,
  csp,
  mode,
  maxHeight,
  onDisplayMode,
  onFailed,
}: {
  block: AppBlock;
  target: ArtifactTarget;
  appDocument: { head: string; body: string };
  csp: ReturnType<typeof mcpAppCsp>;
  mode: McpAppDisplayMode;
  maxHeight: number;
  onDisplayMode: (mode: McpAppDisplayMode) => void;
  onFailed?: () => void;
}) {
  const { i18n } = useLingui();
  const theme = useAppTheme();
  const touch = useMedia("(pointer: coarse)");
  const { open, dialog } = useExternalLinkOpener();
  const frame = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(0);
  const [started, setStarted] = useState(false);
  const latest = useRef(block);
  latest.current = block;
  const hostContext = useMemo(
    () => ({
      theme,
      displayMode: mode,
      availableDisplayModes: ["inline", "fullscreen"],
      containerDimensions: { maxHeight },
      locale: i18n.locale,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      platform: "web",
      deviceCapabilities: { touch, hover: !touch },
    }),
    [theme, i18n.locale, touch, mode, maxHeight],
  );
  // The view's session lasts as long as its document; these change without restarting it.
  const contextRef = useRef(hostContext);
  contextRef.current = hostContext;
  const openRef = useRef(open);
  openRef.current = open;
  const maxRef = useRef(maxHeight);
  maxRef.current = maxHeight;
  const switchRef = useRef(onDisplayMode);
  switchRef.current = onDisplayMode;
  const failRef = useRef(onFailed);
  failRef.current = onFailed;
  const ownMode = useRef(mode);
  const draftKey = useRef(composerDraftKey(target));
  draftKey.current = composerDraftKey(target);

  const host = useMemo(() => {
    const usedGesture = { current: null as string | null, latest: null as string | null };
    const created = createMcpAppHost({
      input: latest.current.toolArguments,
      result: latest.current.toolResult,
      hostContext: contextRef.current,
      csp,
      send: (message) =>
        frame.current?.contentWindow?.postMessage({ type: "rakazo-app:host", message }, "*"),
      // One action per click or key, and only while this frame still holds the focus.
      allowAction: () => {
        const gesture = usedGesture.latest;
        if (!gesture || gesture === usedGesture.current) return false;
        if (document.activeElement !== frame.current) return false;
        usedGesture.current = gesture;
        return true;
      },
      openLink: (url) => openRef.current(url),
      offerMessage: (text) => offerComposerText(draftKey.current, text),
      onHeight: (next) => setHeight(Math.max(Math.ceil(next), MIN_HEIGHT)),
      // The other mode opens in its own session (the dialog or the card); this one keeps its mode.
      setDisplayMode: (next) => {
        if (next !== ownMode.current) switchRef.current(next);
        return ownMode.current;
      },
    });
    return { ...created, usedGesture };
  }, [appDocument, csp]);

  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: unknown; message?: unknown; gesture?: unknown };
      if (data?.type !== "rakazo-app:view") return;
      host.usedGesture.latest = typeof data.gesture === "string" ? data.gesture : null;
      const message = data.message as { method?: unknown };
      if (message?.method === "ui/initialize") setStarted(true);
      host.receive(data.message);
    }
    window.addEventListener("message", receive);
    return () => {
      window.removeEventListener("message", receive);
      host.teardown();
    };
  }, [host]);

  // A running view hears about later changes instead of restarting.
  useEffect(
    () =>
      host.updateContext({
        theme: hostContext.theme,
        locale: hostContext.locale,
        deviceCapabilities: hostContext.deviceCapabilities,
        displayMode: hostContext.displayMode,
        containerDimensions: hostContext.containerDimensions,
      }),
    [host, hostContext],
  );

  useEffect(() => {
    if (started) return;
    const timer = window.setTimeout(() => failRef.current?.(), START_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [started]);

  const shown = started && height ? Math.min(height, maxRef.current) : MIN_HEIGHT * 2;
  return (
    <>
      <iframe
        ref={frame}
        title={block.server}
        src={MCP_APP_VIEWER_PATH}
        sandbox="allow-scripts allow-forms"
        referrerPolicy="no-referrer"
        onLoad={() =>
          frame.current?.contentWindow?.postMessage(
            { type: "rakazo-app:load", ...appDocument },
            "*",
          )
        }
        style={{ height: shown }}
        // The shell declares no colour scheme; matching it keeps the frame see-through.
        className="block w-full border-0 [color-scheme:light]"
      />
      {dialog}
    </>
  );
}
