import { useEffect, useMemo, useState } from "react";
import { KEYBOARD_ROWS, type PhysicalKey } from "@/lib/keyboard-layout";
import { getKeyChar, getKeyMeta, type KeyCategory } from "@/lib/keyboard-metadata";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface VirtualKeyboardProps {
  shiftView: boolean;
  searchQuery: string;
  categoryFilter: KeyCategory | "all";
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
}

/** Does this physical key (at the currently displayed shift layer) match the active search/filter? */
function isKeyMatched(displayKey: string, searchQuery: string, categoryFilter: KeyCategory | "all"): boolean {
  const meta = getKeyMeta(displayKey);
  if (categoryFilter !== "all" && meta?.category !== categoryFilter) return false;

  if (!searchQuery.trim()) return true;
  const q = searchQuery.trim().toLowerCase();
  const char = getKeyChar(displayKey);
  const unicodeHex = [...char].map((c) => "U+" + c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")).join(" ");
  return (
    displayKey.toLowerCase().includes(q) ||
    char.includes(searchQuery.trim()) ||
    unicodeHex.toLowerCase().includes(q) ||
    (meta?.category ?? "").toLowerCase().includes(q) ||
    (meta?.description ?? "").toLowerCase().includes(q)
  );
}

export function VirtualKeyboard({ shiftView, searchQuery, categoryFilter, selectedKey, onSelectKey }: VirtualKeyboardProps) {
  // ── Live key-press highlighting ─────────────────────────────────────────
  // This is a reference/learning page, not the exam engine — it never blocks or intercepts
  // typing. It just listens for physical key presses to visually echo them, so a learner can
  // press a real key and immediately see which Devanagari character it produces.
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const [liveShift, setLiveShift] = useState(false);
  const [liveCtrl, setLiveCtrl] = useState(false);
  const [liveAlt, setLiveAlt] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      setPressed((prev) => new Set(prev).add(normalizeEventKey(e)));
      setLiveShift(e.shiftKey);
      setLiveCtrl(e.ctrlKey || e.metaKey);
      setLiveAlt(e.altKey);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      setPressed((prev) => {
        const next = new Set(prev);
        next.delete(normalizeEventKey(e));
        return next;
      });
      setLiveShift(e.shiftKey);
      setLiveCtrl(e.ctrlKey || e.metaKey);
      setLiveAlt(e.altKey);
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);

  const hasActiveFilter = searchQuery.trim().length > 0 || categoryFilter !== "all";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2 overflow-x-auto pb-2">
        <div className="min-w-[880px] mx-auto space-y-1.5">
          {KEYBOARD_ROWS.map((keys, rowIndex) => (
            <div key={rowIndex} className="flex gap-1.5">
              {keys.map((pk, i) => (
                <KeyCap
                  key={`${rowIndex}-${i}-${pk.key}`}
                  physicalKey={pk}
                  shiftView={shiftView}
                  isPhysicallyPressed={pressed.has(normalizeLayoutKey(pk, shiftView))}
                  isShiftKeyLive={pk.label === "Shift" && liveShift}
                  isCtrlKeyLive={pk.label === "Ctrl" && liveCtrl}
                  isAltKeyLive={pk.label === "Alt" && liveAlt}
                  matched={!hasActiveFilter || (!pk.functional && isKeyMatched(shiftView && pk.shiftKey ? pk.shiftKey : pk.key, searchQuery, categoryFilter))}
                  dimmed={hasActiveFilter && !pk.functional && !isKeyMatched(shiftView && pk.shiftKey ? pk.shiftKey : pk.key, searchQuery, categoryFilter)}
                  selected={selectedKey === (shiftView && pk.shiftKey ? pk.shiftKey : pk.key)}
                  onSelect={onSelectKey}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </TooltipProvider>
  );
}

function normalizeEventKey(e: KeyboardEvent): string {
  if (e.key === "Shift") return "Shift";
  if (e.key === "Control") return "Control";
  if (e.key === "Alt") return "Alt";
  if (e.key === "Meta") return "Meta";
  return e.key;
}

function normalizeLayoutKey(pk: PhysicalKey, shiftView: boolean): string {
  if (pk.functional) return pk.key;
  return shiftView && pk.shiftKey ? pk.shiftKey : pk.key;
}

interface KeyCapProps {
  physicalKey: PhysicalKey;
  shiftView: boolean;
  isPhysicallyPressed: boolean;
  isShiftKeyLive: boolean;
  isCtrlKeyLive: boolean;
  isAltKeyLive: boolean;
  matched: boolean;
  dimmed: boolean;
  selected: boolean;
  onSelect: (key: string | null) => void;
}

function KeyCap({
  physicalKey: pk, shiftView, isPhysicallyPressed, isShiftKeyLive, isCtrlKeyLive, isAltKeyLive,
  dimmed, selected, onSelect,
}: KeyCapProps) {
  const displayKey = shiftView && pk.shiftKey ? pk.shiftKey : pk.key;
  const char = pk.functional ? "" : getKeyChar(displayKey);
  const meta = pk.functional ? undefined : getKeyMeta(displayKey);
  const isLive = isPhysicallyPressed || isShiftKeyLive || isCtrlKeyLive || isAltKeyLive;

  const cap = (
    <button
      type="button"
      disabled={pk.functional}
      onClick={() => !pk.functional && onSelect(displayKey)}
      style={{ flexGrow: pk.width ?? 1, flexBasis: 0 }}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-md border h-14 px-1 transition-all",
        pk.functional
          ? "bg-muted/40 text-muted-foreground text-[10px] font-medium cursor-default"
          : "bg-card hover:bg-accent cursor-pointer",
        isLive && "ring-2 ring-primary bg-primary/10 scale-95",
        selected && "ring-2 ring-primary border-primary",
        dimmed && "opacity-25",
      )}
      data-testid={pk.functional ? undefined : `key-${displayKey}`}
    >
      {pk.functional ? (
        <span>{pk.label}</span>
      ) : (
        <>
          <span className="text-[10px] font-mono uppercase text-muted-foreground leading-none">
            {pk.key === " " ? "Space" : displayKey}
          </span>
          {pk.key !== " " && <span className="text-lg font-bold leading-tight mt-0.5">{char || "·"}</span>}
        </>
      )}
      {meta?.category === "matra" && (
        <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" title="Matra" />
      )}
    </button>
  );

  if (pk.functional || pk.key === " ") return cap;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cap}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-64">
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold">{displayKey}</span>
            <span className="text-lg">{char}</span>
          </div>
          {char && (
            <p className="text-muted-foreground">
              {[...char].map((c) => "U+" + c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")).join(" ")}
            </p>
          )}
          {meta && <p className="text-muted-foreground capitalize">{meta.category.replace("-", " ")}</p>}
          {meta?.description && <p>{meta.description}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
