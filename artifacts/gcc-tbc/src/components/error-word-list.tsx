/**
 * Feature 2: Enhanced Error Word List on Results Page
 * Computes word-by-word diff between passage text and user input,
 * then displays a clean, interactive error breakdown.
 */
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle } from "lucide-react";

interface WordError {
  index: number;
  expected: string;
  actual: string;
  kind: "substitution" | "omission" | "insertion";
}

function computeWordErrors(passage: string, userInput: string): WordError[] {
  const pWords = passage.trim().split(/\s+/).filter(Boolean);
  const uWords = userInput.trim().split(/\s+/).filter(Boolean);
  const errors: WordError[] = [];

  const maxLen = Math.max(pWords.length, uWords.length);
  for (let i = 0; i < maxLen; i++) {
    const expected = pWords[i] ?? "";
    const actual   = uWords[i] ?? "";

    if (expected === actual) continue;

    if (!actual)       errors.push({ index: i, expected, actual: "—",    kind: "omission" });
    else if (!expected) errors.push({ index: i, expected: "—", actual,   kind: "insertion" });
    else               errors.push({ index: i, expected, actual,         kind: "substitution" });
  }
  return errors;
}

interface ErrorWordListProps {
  passageText: string;
  userInput: string;
  className?: string;
}

export function ErrorWordList({ passageText, userInput, className = "" }: ErrorWordListProps) {
  const [highlighted, setHighlighted] = useState<number | null>(null);
  const errors = useMemo(() => computeWordErrors(passageText, userInput), [passageText, userInput]);

  if (!passageText || !userInput) return null;

  const pWords = passageText.trim().split(/\s+/).filter(Boolean);
  const errorSet = new Set(errors.map(e => e.index));

  const kindColor = {
    substitution: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
    omission:     "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300",
    insertion:    "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300",
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {errors.length === 0
            ? <><CheckCircle className="h-4 w-4 text-green-500" /> Perfect – No Errors</>
            : <><AlertTriangle className="h-4 w-4 text-red-500" /> Error Word Analysis ({errors.length} word{errors.length !== 1 ? "s" : ""})</>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Highlighted passage */}
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Passage (errors highlighted)</p>
          <p className="text-sm leading-8 font-mono break-words">
            {pWords.map((word, i) => (
              <span
                key={i}
                onMouseEnter={() => setHighlighted(i)}
                onMouseLeave={() => setHighlighted(null)}
                className={[
                  "inline-block mr-1 px-0.5 rounded transition-colors cursor-default",
                  errorSet.has(i)
                    ? highlighted === i
                      ? "bg-red-400 text-white"
                      : "bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200"
                    : highlighted === i
                      ? "bg-green-200 dark:bg-green-800"
                      : "",
                ].join(" ")}
              >
                {word}
              </span>
            ))}
          </p>
        </div>

        {/* Error table */}
        {errors.length > 0 && (
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2 font-medium">Detailed errors</p>
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">#</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Expected</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">You Typed</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Type</th>
                  </tr>
                </thead>
                <tbody>
                  {errors.map((err) => (
                    <tr
                      key={err.index}
                      onMouseEnter={() => setHighlighted(err.index)}
                      onMouseLeave={() => setHighlighted(null)}
                      className={`border-t transition-colors ${highlighted === err.index ? "bg-muted/30" : ""}`}
                    >
                      <td className="px-3 py-2 text-xs text-muted-foreground">{err.index + 1}</td>
                      <td className="px-3 py-2 font-mono text-green-700 dark:text-green-400">{err.expected}</td>
                      <td className="px-3 py-2 font-mono text-red-700 dark:text-red-400">{err.actual}</td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${kindColor[err.kind]}`}>
                          {err.kind}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary badges */}
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-green-700 dark:text-green-400 border-green-300">
            ✓ {pWords.length - errors.length} correct
          </Badge>
          {errors.filter(e => e.kind === "substitution").length > 0 && (
            <Badge variant="outline" className="text-red-700 dark:text-red-400 border-red-300">
              ✗ {errors.filter(e => e.kind === "substitution").length} substituted
            </Badge>
          )}
          {errors.filter(e => e.kind === "omission").length > 0 && (
            <Badge variant="outline" className="text-yellow-700 dark:text-yellow-400 border-yellow-300">
              ⚠ {errors.filter(e => e.kind === "omission").length} omitted
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
