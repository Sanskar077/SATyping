import { useListPassages, useDeletePassage, getListPassagesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Trash2, BookOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/context/AuthContext";

export default function Passages() {
  const { user } = useAuth();
  const [language, setLanguage] = useState<string>("");
  const [difficulty, setDifficulty] = useState<string>("");
  const [search, setSearch] = useState("");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const params: Record<string, string | number> = { page: 1, limit: 20 };
  if (language && language !== "all") params.language = language;
  if (difficulty && difficulty !== "all") params.difficulty = difficulty;
  if (search) params.search = search;

  const { data, isLoading } = useListPassages(params as Parameters<typeof useListPassages>[0], {
    query: { queryKey: getListPassagesQueryKey(params as Parameters<typeof useListPassages>[0]) },
  });

  const deletePassage = useDeletePassage();
  const canManage = ["teacher", "institute_admin", "super_admin"].includes(user?.role ?? "");

  const handleDelete = (id: number) => {
    deletePassage.mutate({ id }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListPassagesQueryKey() });
        toast({ title: "Passage deleted" });
      },
      onError: () => toast({ title: "Failed to delete passage", variant: "destructive" }),
    });
  };

  const langColors: Record<string, string> = {
    english: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    hindi: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
    marathi: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  };

  const diffColors: Record<string, string> = {
    easy: "bg-green-100 text-green-700",
    medium: "bg-yellow-100 text-yellow-700",
    hard: "bg-red-100 text-red-700",
  };

  return (
    <div className="space-y-6" data-testid="passages-page">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Passages</h1>
          <p className="text-muted-foreground mt-1">Typing passages library</p>
        </div>
        {canManage && (
          <Button asChild data-testid="button-add-passage">
            <Link href="/passages/new"><Plus className="mr-2 h-4 w-4" />Add Passage</Link>
          </Button>
        )}
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search passages..." value={search} onChange={e => setSearch(e.target.value)} data-testid="input-search" />
        </div>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-36" data-testid="select-language">
            <SelectValue placeholder="Language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Languages</SelectItem>
            <SelectItem value="english">English</SelectItem>
            <SelectItem value="hindi">Hindi</SelectItem>
            <SelectItem value="marathi">Marathi</SelectItem>
          </SelectContent>
        </Select>
        <Select value={difficulty} onValueChange={setDifficulty}>
          <SelectTrigger className="w-36" data-testid="select-difficulty">
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            <SelectItem value="easy">Easy</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="hard">Hard</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">Loading passages...</div>
      ) : !data?.passages.length ? (
        <div className="text-center py-16 text-muted-foreground">
          <BookOpen className="mx-auto h-12 w-12 opacity-30 mb-3" />
          <p>No passages found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data.passages.map(passage => (
            <Card key={passage.id} className="hover:shadow-sm transition-shadow" data-testid={`card-passage-${passage.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{passage.title}</h3>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{passage.content}</p>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${langColors[passage.language] ?? "bg-gray-100"}`}>
                        {passage.language}
                      </span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium capitalize ${diffColors[passage.difficulty] ?? "bg-gray-100"}`}>
                        {passage.difficulty}
                      </span>
                      <Badge variant="outline" className="text-xs">{passage.speedCategory} WPM</Badge>
                      <span className="text-xs text-muted-foreground self-center">{passage.wordCount} words</span>
                    </div>
                  </div>
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(passage.id)}
                      data-testid={`button-delete-passage-${passage.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
