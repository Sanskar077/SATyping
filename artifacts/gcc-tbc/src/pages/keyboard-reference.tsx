import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { VirtualKeyboard } from "@/components/virtual-keyboard";
import { KeyDetailsPanel } from "@/components/keyboard-key-details";
import { MappingTable } from "@/components/keyboard-mapping-table";
import { CATEGORY_LABELS, type KeyCategory } from "@/lib/keyboard-metadata";
import { Search, Keyboard } from "lucide-react";

const FILTERS: Array<{ value: KeyCategory | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "consonant", label: CATEGORY_LABELS.consonant },
  { value: "vowel", label: CATEGORY_LABELS.vowel },
  { value: "matra", label: CATEGORY_LABELS.matra },
  { value: "conjunct", label: CATEGORY_LABELS.conjunct },
  { value: "half-letter", label: CATEGORY_LABELS["half-letter"] },
  { value: "number", label: CATEGORY_LABELS.number },
  { value: "symbol", label: CATEGORY_LABELS.symbol },
  { value: "punctuation", label: CATEGORY_LABELS.punctuation },
];

export default function KeyboardReference() {
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<KeyCategory | "all">("all");
  const [shiftView, setShiftView] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  return (
    <div className="space-y-6" data-testid="keyboard-reference-page">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
          <Keyboard className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Marathi Keyboard</h1>
          <p className="text-muted-foreground mt-0.5">ISM Remington layout — hover, search, or click any key to learn it</p>
        </div>
      </div>

      <Tabs defaultValue="keyboard">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <TabsList>
            <TabsTrigger value="keyboard" data-testid="tab-virtual-keyboard">Virtual Keyboard</TabsTrigger>
            <TabsTrigger value="table" data-testid="tab-mapping-table">Mapping Table</TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground absolute ml-3" />
            <Input
              placeholder="Search key, character, Unicode..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 w-64"
              data-testid="input-keyboard-search"
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
          <ToggleGroup
            type="single"
            value={categoryFilter}
            onValueChange={(v) => v && setCategoryFilter(v as KeyCategory | "all")}
            className="flex-wrap justify-start"
          >
            {FILTERS.map((f) => (
              <ToggleGroupItem key={f.value} value={f.value} size="sm" className="text-xs" data-testid={`filter-${f.value}`}>
                {f.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>

          <div className="flex items-center gap-2">
            <Label htmlFor="shift-toggle" className="text-sm text-muted-foreground">
              {shiftView ? "With Shift" : "Without Shift"}
            </Label>
            <Switch id="shift-toggle" checked={shiftView} onCheckedChange={setShiftView} data-testid="switch-shift-toggle" />
          </div>
        </div>

        <TabsContent value="keyboard" className="mt-6">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <VirtualKeyboard
              shiftView={shiftView}
              searchQuery={searchQuery}
              categoryFilter={categoryFilter}
              selectedKey={selectedKey}
              onSelectKey={setSelectedKey}
            />
            <KeyDetailsPanel selectedKey={selectedKey} />
          </div>
        </TabsContent>

        <TabsContent value="table" className="mt-6">
          <MappingTable searchQuery={searchQuery} categoryFilter={categoryFilter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
