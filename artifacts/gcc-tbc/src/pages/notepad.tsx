/**
 * Typing Notepad — free typing practice surface.
 *
 * Lets a user type freely (no exam, no passage, no grading) to warm up or
 * test the keyboard layout. It NEVER uses a different typing engine: the
 * exact same useTypingEngine hook and attachTypingKeyHandlers key-resolution
 * logic that power exams/practice/drills power this page too (freeMode).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  NotebookPen, Copy, Trash2, Undo2, Redo2, Type, Hash, Gauge, ClipboardPaste,
} from "lucide-react";
import { useTypingEngine } from "@/hooks/use-typing-engine";
import { NotepadTypingArea } from "@/components/notepad-typing-area";

type NotepadLanguage = "english" | "marathi" | "hindi";

const LANGUAGE_LABELS: Record<NotepadLanguage, string> = {
  english: "English",
  marathi: "Marathi (मराठी)",
  hindi:   "Hindi (हिन्दी)",
};

const STORAGE_PREFIX = "satyping:notepad:";

export default function Notepad() {
  const { toast } = useToast();
  const [language, setLanguage] = useState<NotepadLanguage>("marathi");

  const engine = useTypingEngine({
    passageText: "",
    language,
    freeMode: true,
  });
  const { typedText, stats, elapsedSeconds, setText, reset, textareaRef } = engine;

  // ── Undo / Redo history (character-granular) ──────────────────────────
  const historyRef   = useRef<string[]>([""]);
  const histIndexRef = useRef(0);
  const applyingHistoryRef = useRef(false);

  useEffect(() => {
    if (applyingHistoryRef.current) { applyingHistoryRef.current = false; return; }
    const h = historyRef.current.slice(0, histIndexRef.current + 1);
    h.push(typedText);
    historyRef.current = h;
    histIndexRef.current = h.length - 1;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typedText]);

  // ── Load saved text for this language on mount / language change ──────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PREFIX + language);
      applyingHistoryRef.current = true;
      setText(saved ?? "");
      historyRef.current = [saved ?? ""];
      histIndexRef.current = 0;
    } catch {
      // localStorage unavailable (private browsing, etc.) — notepad still works, just won't persist.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const handleUndo = useCallback(() => {
    if (histIndexRef.current <= 0) return;
    histIndexRef.current -= 1;
    applyingHistoryRef.current = true;
    setText(historyRef.current[histIndexRef.current] ?? "");
  }, [setText]);

  const handleRedo = useCallback(() => {
    if (histIndexRef.current >= historyRef.current.length - 1) return;
    histIndexRef.current += 1;
    applyingHistoryRef.current = true;
    setText(historyRef.current[histIndexRef.current] ?? "");
  }, [setText]);

  const handlePaste = useCallback((text: string) => {
    // Pasted text is already committed Unicode — appended as-is, never
    // re-validated against raw keys (matches ISM V6 behaviour).
    engine.appendChars(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engine]);

  const handleSelectAll = useCallback(() => {
    const el = document.getElementById("notepad-text-display");
    if (!el) return;
    const range = document.createRange();
    range.selectNodeContents(el);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, []);

  const handleCopy = useCallback(() => {
    navigator.clipboard?.writeText(typedText).then(() => {
      toast({ title: "Copied", description: "Notepad text copied to clipboard." });
    }).catch(() => {
      toast({ title: "Copy failed", description: "Your browser blocked clipboard access.", variant: "destructive" });
    });
  }, [typedText, toast]);

  const handleClear = useCallback(() => {
    reset();
    historyRef.current = [""];
    histIndexRef.current = 0;
    textareaRef.current?.focus();
  }, [reset, textareaRef]);

  const handleSave = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_PREFIX + language, typedText);
      toast({ title: "Saved", description: `${LANGUAGE_LABELS[language]} notepad saved on this device.` });
    } catch {
      toast({ title: "Save failed", description: "Local storage isn't available.", variant: "destructive" });
    }
  }, [language, typedText, toast]);

  const wordCount = typedText.trim().length
    ? typedText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <NotebookPen className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">Typing Notepad</h1>
        </div>

        <Select value={language} onValueChange={(v) => setLanguage(v as NotepadLanguage)}>
          <SelectTrigger className="w-48" aria-label="Notepad language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="english">{LANGUAGE_LABELS.english}</SelectItem>
            <SelectItem value="marathi">{LANGUAGE_LABELS.marathi}</SelectItem>
            <SelectItem value="hindi">{LANGUAGE_LABELS.hindi}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <p className="text-sm text-muted-foreground">
        Free-typing practice space — no exam, no grading. Uses the exact same ISM Remington
        keyboard engine as Practice and Exams, so muscle memory carries over directly.
      </p>

      {/* Live stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Hash className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Characters</p>
              <p className="text-lg font-semibold">{stats.totalTyped}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Type className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Words</p>
              <p className="text-lg font-semibold">{wordCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Gauge className="h-5 w-5 text-primary shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">Speed</p>
              <p className="text-lg font-semibold">{stats.grossWpm} WPM</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Badge variant="secondary" className="shrink-0">⏱</Badge>
            <div>
              <p className="text-xs text-muted-foreground">Time</p>
              <p className="text-lg font-semibold">{elapsedSeconds}s</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">{LANGUAGE_LABELS[language]}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleUndo} title="Undo (Ctrl+Z)">
              <Undo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleRedo} title="Redo (Ctrl+Y)">
              <Redo2 className="h-4 w-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopy} title="Copy (Ctrl+C)">
              <Copy className="h-4 w-4 mr-1" /> Copy
            </Button>
            <Button size="sm" variant="outline" onClick={handleClear} title="Clear">
              <Trash2 className="h-4 w-4 mr-1" /> Clear
            </Button>
            <Button size="sm" onClick={handleSave} title="Save to this device">
              Save
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <NotepadTypingArea
            engine={engine}
            language={language}
            onPaste={handlePaste}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onSelectAll={handleSelectAll}
            onCopy={handleCopy}
          />
          <p className="mt-2 text-xs text-muted-foreground flex items-center gap-1">
            <ClipboardPaste className="h-3.5 w-3.5" />
            Paste supported (Ctrl+V) · Ctrl+A selects all · Ctrl+Z/Ctrl+Y undo/redo
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
