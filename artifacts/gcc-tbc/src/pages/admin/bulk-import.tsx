/**
 * Feature 9: Admin Passage Bulk Import Matrix
 * Allows admins to paste CSV/JSON data and import passages in bulk.
 * Two-step: validate → review → import.
 */
import { useState, useCallback } from "react";
import { useBulkValidatePassages, useBulkImportPassages } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { Upload, CheckCircle, AlertTriangle, XCircle, FileText, ArrowRight, RotateCcw } from "lucide-react";
import { Link } from "wouter";

import {
  BulkPassageRowLanguage, BulkPassageRowDifficulty, BulkPassageRowSpeedCategory,
  type BulkPassageRow, type BulkImportValidation,
} from "@workspace/api-client-react";
type PassageRow = BulkPassageRow;

type Step = "input" | "validate" | "done";

const TEMPLATE_CSV = `title,content,language,difficulty,speedCategory
My First Passage,"The quick brown fox jumps over the lazy dog.",english,easy,30
Hindi Sample,"यह एक हिंदी उदाहरण है। कृपया ध्यान से टाइप करें।",hindi,easy,30
Marathi Sample,"मराठी टायपिंग साठी हे उदाहरण आहे।",marathi,easy,30`;

function parseCSV(csv: string): PassageRow[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  return lines.slice(1).map(line => {
    // Handle quoted fields
    const fields: string[] = [];
    let cur = "", inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; continue; }
      if (ch === "," && !inQ) { fields.push(cur.trim()); cur = ""; }
      else cur += ch;
    }
    fields.push(cur.trim());

    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = fields[i] ?? ""; });
    const lang = (row.language ?? "english") as BulkPassageRowLanguage;
    const diff = (row.difficulty ?? "medium") as BulkPassageRowDifficulty;
    const spd = parseInt(row.speedCategory ?? "30", 10) as BulkPassageRowSpeedCategory;
    return {
      title: row.title ?? "",
      content: row.content ?? "",
      language: lang,
      difficulty: diff,
      speedCategory: spd,
    };
  }).filter(r => r.title);
}

function parseJSON(json: string): PassageRow[] {
  try {
    const data = JSON.parse(json);
    return Array.isArray(data) ? data : [];
  } catch { return []; }
}

export default function BulkImport() {
  const [step, setStep]       = useState<Step>("input");
  const [format, setFormat]   = useState<"csv" | "json">("csv");
  const [raw, setRaw]         = useState("");
  const [rows, setRows]       = useState<PassageRow[]>([]);
  const [validation, setValidation] = useState<BulkImportValidation | null>(null);
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null);

  const validate = useBulkValidatePassages();
  const bulkImport = useBulkImportPassages();
  const { toast } = useToast();

  const handleParse = () => {
    const parsed = format === "csv" ? parseCSV(raw) : parseJSON(raw);
    if (parsed.length === 0) {
      toast({ title: "Parse error", description: "No valid rows found. Check your format.", variant: "destructive" });
      return;
    }
    setRows(parsed);
    validate.mutate({ data: { passages: parsed } }, {
      onSuccess: (result) => { setValidation(result); setStep("validate"); },
      onError: () => toast({ title: "Validation failed", description: "Server error during validation.", variant: "destructive" }),
    });
  };

  const handleImport = () => {
    if (!validation?.valid.length) return;
    bulkImport.mutate({ data: { passages: validation.valid } }, {
      onSuccess: (result) => {
        setImportResult({ imported: result.imported, skipped: result.skipped });
        setStep("done");
        toast({ title: "Import complete", description: `${result.imported} passages imported successfully.` });
      },
      onError: () => toast({ title: "Import failed", description: "Server error during import.", variant: "destructive" }),
    });
  };

  const handleReset = () => {
    setStep("input"); setRaw(""); setRows([]); setValidation(null); setImportResult(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/admin" className="hover:text-foreground">Admin</Link>
          <span>/</span>
          <span>Bulk Import</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Upload className="h-7 w-7 text-primary" />
          Bulk Passage Import
        </h1>
        <p className="text-muted-foreground mt-1">Import multiple passages at once via CSV or JSON.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 text-sm">
        {(["input", "validate", "done"] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            {i > 0 && <ArrowRight className="h-4 w-4 text-muted-foreground" />}
            <span className={`px-3 py-1 rounded-full font-medium ${step === s
              ? "bg-primary text-primary-foreground"
              : (["input","validate","done"] as const).indexOf(step) > i
                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                : "bg-muted text-muted-foreground"}`}>
              {i + 1}. {s === "input" ? "Input Data" : s === "validate" ? "Review" : "Done"}
            </span>
          </div>
        ))}
      </div>

      {/* Step 1: Input */}
      {step === "input" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> Paste Your Data
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              <Select value={format} onValueChange={(v) => setFormat(v as "csv" | "json")}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline" size="sm"
                onClick={() => setRaw(format === "csv" ? TEMPLATE_CSV : JSON.stringify(parseCSV(TEMPLATE_CSV), null, 2))}
              >
                Load Template
              </Button>
            </div>

            <Textarea
              placeholder={format === "csv"
                ? "title,content,language,difficulty,speedCategory\nMy Passage,\"Paste passage text here...\",english,easy,30"
                : '[{"title":"...", "content":"...", "language":"english", "difficulty":"easy", "speedCategory":30}]'}
              value={raw}
              onChange={e => setRaw(e.target.value)}
              className="font-mono text-xs min-h-[200px]"
            />

            <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Required columns / fields:</p>
              <p>• <code className="font-mono">title</code> — passage title (min 2 chars)</p>
              <p>• <code className="font-mono">content</code> — passage body (min 10 chars)</p>
              <p>• <code className="font-mono">language</code> — english | hindi | marathi</p>
              <p>• <code className="font-mono">difficulty</code> — easy | medium | hard</p>
              <p>• <code className="font-mono">speedCategory</code> — 30 | 40 | 50 | 60</p>
            </div>

            <Button
              onClick={handleParse}
              disabled={!raw.trim() || validate.isPending}
              className="gap-2"
            >
              {validate.isPending ? "Validating…" : "Validate & Preview"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review */}
      {step === "validate" && validation && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-green-200 dark:border-green-900">
              <CardContent className="pt-4 flex items-center gap-3">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <div>
                  <p className="text-2xl font-bold text-green-600">{validation.validCount}</p>
                  <p className="text-xs text-muted-foreground">Ready to import</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardContent className="pt-4 flex items-center gap-3">
                <AlertTriangle className="h-8 w-8 text-yellow-500" />
                <div>
                  <p className="text-2xl font-bold text-yellow-600">{validation.duplicateCount}</p>
                  <p className="text-xs text-muted-foreground">Duplicates (will skip)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-red-200 dark:border-red-900">
              <CardContent className="pt-4 flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-500" />
                <div>
                  <p className="text-2xl font-bold text-red-600">{validation.errorCount}</p>
                  <p className="text-xs text-muted-foreground">Validation errors</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Valid rows preview */}
          {validation.valid.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">Valid Passages ({validation.validCount})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-8">#</TableHead>
                        <TableHead>Title</TableHead>
                        <TableHead>Language</TableHead>
                        <TableHead>Difficulty</TableHead>
                        <TableHead>Speed</TableHead>
                        <TableHead>Words</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validation.valid.map((p, i) => (
                        <TableRow key={i}>
                          <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium max-w-[200px] truncate">{p.title}</TableCell>
                          <TableCell className="capitalize">{p.language}</TableCell>
                          <TableCell className="capitalize">{p.difficulty}</TableCell>
                          <TableCell>{p.speedCategory} WPM</TableCell>
                          <TableCell>{p.content.trim().split(/\s+/).length}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Errors */}
          {validation.errors.length > 0 && (
            <Card className="border-red-200 dark:border-red-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-red-600">Errors ({validation.errorCount})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="flex gap-3 text-sm">
                      <Badge variant="outline" className="text-red-600 border-red-300 flex-shrink-0">Row {err.row}</Badge>
                      <span><span className="font-medium capitalize">{err.field}:</span> {err.message}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Duplicates */}
          {validation.duplicates.length > 0 && (
            <Card className="border-yellow-200 dark:border-yellow-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-yellow-600">Duplicates — will be skipped ({validation.duplicateCount})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm">
                  {validation.duplicates.map((d, i) => (
                    <div key={i} className="flex gap-2">
                      <Badge variant="outline" className="text-yellow-600 border-yellow-300 flex-shrink-0">Row {d.row}</Badge>
                      <span className="text-muted-foreground">"{d.title}" already exists (ID: {d.existingId})</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleReset} className="gap-1">
              <RotateCcw className="h-4 w-4" /> Start Over
            </Button>
            <Button
              onClick={handleImport}
              disabled={validation.validCount === 0 || bulkImport.isPending}
              className="gap-2"
            >
              {bulkImport.isPending ? "Importing…" : `Import ${validation.validCount} Passage${validation.validCount !== 1 ? "s" : ""}`}
              <Upload className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Done */}
      {step === "done" && importResult && (
        <Card className="border-green-300 dark:border-green-800">
          <CardContent className="pt-8 pb-10 text-center space-y-4">
            <CheckCircle className="h-14 w-14 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold">Import Complete!</h2>
            <p className="text-muted-foreground">
              <span className="text-green-600 font-bold">{importResult.imported}</span> passages imported·{" "}
              <span className="text-yellow-600 font-bold">{importResult.skipped}</span> skipped (duplicates)
            </p>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={handleReset} className="gap-1">
                <Upload className="h-4 w-4" /> Import More
              </Button>
              <Button asChild>
                <Link href="/passages">View Passages</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
