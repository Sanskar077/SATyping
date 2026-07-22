import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { KEY_METADATA, CATEGORY_LABELS, type KeyCategory } from "@/lib/keyboard-metadata";
import { getKeyChar } from "@/lib/keyboard-metadata";

interface MappingTableProps {
  searchQuery: string;
  categoryFilter: KeyCategory | "all";
}

export function MappingTable({ searchQuery, categoryFilter }: MappingTableProps) {
  const q = searchQuery.trim().toLowerCase();

  const rows = KEY_METADATA.filter((m) => {
    if (categoryFilter !== "all" && m.category !== categoryFilter) return false;
    if (!q) return true;
    const char = getKeyChar(m.key);
    return (
      m.key.toLowerCase().includes(q) ||
      char.includes(searchQuery.trim()) ||
      m.description.toLowerCase().includes(q) ||
      m.category.toLowerCase().includes(q)
    );
  });

  if (rows.length === 0) {
    return <p className="text-center text-muted-foreground py-12 text-sm">No keys match your search/filter.</p>;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Character</TableHead>
            <TableHead>Unicode</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Description</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((m) => {
            const char = getKeyChar(m.key);
            const unicode = [...char].map((c) => "U+" + c.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")).join(" ");
            return (
              <TableRow key={m.key}>
                <TableCell className="font-mono text-xs uppercase">{m.key === " " ? "Space" : m.key}</TableCell>
                <TableCell className="text-lg">{char || "·"}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">{unicode || "—"}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs capitalize">{CATEGORY_LABELS[m.category]}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{m.description}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
