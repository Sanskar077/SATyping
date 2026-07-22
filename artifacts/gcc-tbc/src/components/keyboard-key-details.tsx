import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getKeyChar, getKeyMeta, CATEGORY_LABELS } from "@/lib/keyboard-metadata";
import { MousePointerClick } from "lucide-react";

interface KeyDetailsPanelProps {
  selectedKey: string | null;
}

export function KeyDetailsPanel({ selectedKey }: KeyDetailsPanelProps) {
  if (!selectedKey) {
    return (
      <Card className="h-full">
        <CardContent className="flex flex-col items-center justify-center text-center h-full py-10 text-muted-foreground">
          <MousePointerClick className="h-8 w-8 mb-3 opacity-40" />
          <p className="text-sm">Click any key on the keyboard to see its full details here.</p>
        </CardContent>
      </Card>
    );
  }

  const char = getKeyChar(selectedKey);
  const meta = getKeyMeta(selectedKey);
  const unicodePoints = [...char].map((c) => "U+" + c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0"));

  return (
    <Card className="h-full" data-testid="key-details-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-3">
          <span className="text-3xl leading-none">{char || "·"}</span>
          <span className="flex flex-col">
            <span className="text-sm font-mono text-muted-foreground uppercase">Key: {selectedKey === " " ? "Space" : selectedKey}</span>
            {meta && <Badge variant="outline" className="w-fit mt-1 text-xs capitalize">{CATEGORY_LABELS[meta.category]}</Badge>}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {char && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Unicode</p>
            <p className="font-mono">{unicodePoints.join(", ")}</p>
          </div>
        )}
        {meta?.description && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Usage</p>
            <p>{meta.description}</p>
          </div>
        )}
        {meta?.examples && meta.examples.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Example words</p>
            <div className="flex flex-wrap gap-2">
              {meta.examples.map((word) => (
                <span key={word} className="px-2 py-1 rounded-md bg-muted text-base">{word}</span>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
