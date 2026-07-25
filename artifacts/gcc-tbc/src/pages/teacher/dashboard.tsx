import { useListPassages, useListTests, getListTestsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { BookOpen, FileText, Plus, GraduationCap, ArrowRight, PencilRuler } from "lucide-react";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

export default function TeacherDashboard() {
  const { user } = useAuth();
  const instituteId = user?.instituteId ?? undefined;

  // Passages the API can return for this teacher; we surface the ones THEY authored (createdBy).
  const { data: passagesData, isLoading: passagesLoading } = useListPassages({ limit: 100 });
  const testsParams = { instituteId };
  const { data: testsData, isLoading: testsLoading } = useListTests(testsParams, {
    query: { enabled: !!instituteId, queryKey: getListTestsQueryKey(testsParams) },
  });

  const myPassages = (passagesData?.passages ?? []).filter((p) => p.createdBy === user?.id);
  const tests = testsData?.tests ?? [];

  return (
    <div className="space-y-6" data-testid="teacher-dashboard">
      <EmailVerificationBanner emailVerified={user?.emailVerified} />

      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Teacher</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome, {user?.name}</h1>
          <p className="text-muted-foreground mt-1">Manage your passages and tests.</p>
        </div>
        <Button asChild>
          <Link href="/passages/new"><Plus className="mr-2 h-4 w-4" />New Passage</Link>
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><BookOpen className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-3xl font-bold">{passagesLoading ? "—" : myPassages.length}</p>
              <p className="text-sm text-muted-foreground">Passages authored</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><FileText className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-3xl font-bold">{testsLoading ? "—" : tests.length}</p>
              <p className="text-sm text-muted-foreground">Tests in your institute</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10"><PencilRuler className="h-6 w-6 text-primary" /></div>
            <div>
              <p className="text-3xl font-bold">
                {passagesLoading ? "—" : myPassages.filter((p) => p.isActive !== false).length}
              </p>
              <p className="text-sm text-muted-foreground">Active passages</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Passages authored */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-base">Your Passages</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/passages">Manage <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myPassages.slice(0, 5).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.title}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{p.language}</TableCell>
                    <TableCell>
                      <Badge variant={p.isActive !== false ? "default" : "secondary"} className="text-xs">
                        {p.isActive !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!passagesLoading && myPassages.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      You haven't authored any passages yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        {/* Tests managed */}
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3 space-y-0">
            <CardTitle className="text-base">Tests</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/exams">View <ArrowRight className="ml-1 h-3.5 w-3.5" /></Link>
            </Button>
          </CardHeader>
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.slice(0, 5).map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{t.language}</TableCell>
                    <TableCell>
                      <Badge variant={t.isActive ? "default" : "secondary"} className="text-xs">
                        {t.isActive ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {!testsLoading && tests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">
                      No tests in your institute yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
}
