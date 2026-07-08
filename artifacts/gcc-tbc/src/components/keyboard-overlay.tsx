/**
 * Feature 7: Multilingual Keyboard Shortcut Reference Overlay
 * Opens on pressing '?' globally. Shows keyboard layouts for English,
 * Hindi (Inscript), and Marathi (ISM Remington) with shortcut references.
 */
import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Keyboard } from "lucide-react";
import { REMINGTON_MAP, PRE_I_SENTINEL } from "@/lib/ism-remington-map";

// Optional human-readable hints for specific keys — annotation only, never a
// second copy of the actual character data (that always comes from
// REMINGTON_MAP, the single source of truth also used by the typing engine).
const KEY_HINTS: Record<string, string> = {
  f: "i-matra (pre-consonant — the ONLY pre-consonant key)",
  h: "long-i matra (post-consonant)",
  k: "aa matra",
  q: "u matra",
  s: "e matra",
  w: "long-u matra",
  z: "subjoined-ra conjunct",
  A: "aa matra (alt key)",
  S: "ai matra",
  W: "candra-E / short-e matra",
  J: "shra conjunct",
  K: "dnya conjunct",
  Z: "explicit half-ra",
  "+": "bare virama — forms conjuncts & reph",
  "~": "dya conjunct",
  "(": "tra conjunct",
  "*": "ddha conjunct",
  "}": "dva conjunct",
  "{": "half of ksha conjunct",
};

function sample(key: string): { key: string; char: string; desc?: string } {
  const raw = REMINGTON_MAP[key];
  const char = raw === PRE_I_SENTINEL ? "ि" : raw ?? "";
  return { key, char, desc: KEY_HINTS[key] };
}

const NOSHIFT_QWERTY = ["q","w","e","r","t","y","u","i","o","p","[","]"].map(sample);
const NOSHIFT_HOME   = ["a","s","d","f","g","h","j","k","l",";","'"].map(sample);
const NOSHIFT_BOTTOM = ["z","x","c","v","b","n","m",",","."].map(sample);
const SHIFT_ROW_1     = ["Q","W","E","R","T","Y","U","I","A","S","D","F","G"].map(sample);
const SHIFT_ROW_2     = ["H","J","K","L","Z","X","C","M",":","\"",">","?"].map(sample);

const APP_SHORTCUTS = [
  { key: "?", desc: "Open this keyboard reference" },
  { key: "Ctrl + Enter", desc: "Submit / Complete session early" },
  { key: "Backspace", desc: "Delete last character" },
  { key: "Tab", desc: "Blocked during typing (intentional)" },
  { key: "Ctrl + A", desc: "Blocked during typing" },
];

const PRACTICE_TIPS = [
  "Keep your fingers on the home row (ASDF / JKL;).",
  "Look at the screen, not the keyboard — train muscle memory.",
  "Type steadily. Accuracy matters more than speed.",
  "Use the ISM Remington layout for Marathi/Hindi inputs.",
  "The ि (i-matra) comes BEFORE the consonant in ISM Remington — press 'f' first, then the consonant.",
  "Practice one letter group at a time using the Curriculum section.",
];

interface KeyRowProps {
  items: { key: string; char: string; desc?: string }[];
}

function KeyRow({ items }: KeyRowProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(({ key, char, desc }) => (
        <div key={key} className="flex flex-col items-center w-14 rounded-lg border bg-muted/30 p-1.5 hover:bg-muted transition-colors">
          <span className="text-xs font-mono text-muted-foreground uppercase leading-none">{key}</span>
          <span className="text-xl font-bold leading-tight mt-0.5">{char}</span>
          {desc && <span className="text-[9px] text-muted-foreground text-center leading-tight mt-0.5">{desc}</span>}
        </div>
      ))}
    </div>
  );
}

export function KeyboardOverlay() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.key === "?" &&
        !e.ctrlKey && !e.metaKey &&
        !(document.activeElement instanceof HTMLInputElement) &&
        !(document.activeElement instanceof HTMLTextAreaElement)
      ) {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5 text-primary" />
            Keyboard Reference &amp; Shortcuts
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="remington">
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="remington">ISM Remington (Marathi/Hindi)</TabsTrigger>
            <TabsTrigger value="shortcuts">App Shortcuts</TabsTrigger>
            <TabsTrigger value="tips">Typing Tips</TabsTrigger>
          </TabsList>

          <TabsContent value="remington" className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              ISM Remington layout: physical keys map to Devanagari characters. The <strong>i-matra (ि)</strong> is
              typed by pressing <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">f</kbd> <em>before</em> the consonant — it is the only pre-consonant key.
            </p>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">No-Shift (main keys)</p>
            <KeyRow items={NOSHIFT_QWERTY} />
            <KeyRow items={NOSHIFT_HOME} />
            <KeyRow items={NOSHIFT_BOTTOM} />

            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground pt-1">Shift layer (selected)</p>
            <KeyRow items={SHIFT_ROW_1} />
            <KeyRow items={SHIFT_ROW_2} />

            <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-sm">
              <strong>ि / ी rule:</strong>{" "}
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">f</kbd> <em>before</em> the consonant for ि (short-i).{" "}
              Press <kbd className="px-1 py-0.5 bg-muted rounded text-xs font-mono">h</kbd> <em>after</em> the consonant for ी (long-i).{" "}
              Example: कि = <kbd className="font-mono text-xs px-1 bg-muted rounded">f</kbd>+<kbd className="font-mono text-xs px-1 bg-muted rounded">d</kbd> &nbsp;|&nbsp;
              की = <kbd className="font-mono text-xs px-1 bg-muted rounded">d</kbd>+<kbd className="font-mono text-xs px-1 bg-muted rounded">h</kbd>.
            </div>
          </TabsContent>

          <TabsContent value="shortcuts" className="pt-4">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Key / Combo</th>
                    <th className="text-left px-4 py-2 font-medium text-muted-foreground">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {APP_SHORTCUTS.map(({ key, desc }) => (
                    <tr key={key} className="border-t">
                      <td className="px-4 py-2.5">
                        <kbd className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{key}</kbd>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="tips" className="pt-4">
            <ul className="space-y-3">
              {PRACTICE_TIPS.map((tip, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-bold">
                    {i + 1}
                  </span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </TabsContent>
        </Tabs>

        <p className="text-xs text-muted-foreground text-center pt-2">
          Press <kbd className="px-1 py-0.5 bg-muted rounded font-mono">?</kbd> anytime to open this reference (when not typing).
        </p>
      </DialogContent>
    </Dialog>
  );
}
