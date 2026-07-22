import { useGetInstitute, useGetInstituteStudents, useListTests, getGetInstituteQueryKey, getGetInstituteStudentsQueryKey, getListTestsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Users, BookOpen, Trophy, Plus, Settings, Wallet } from "lucide-react";
import { EmailVerificationBanner } from "@/components/email-verification-banner";

export default function InstituteDashboard() {
  const { user } = useAuth();
  const instituteId = user?.instituteId ?? 0;

  const { data: institute, isLoading: instituteLoading } = useGetInstitute(instituteId, {
    query: { enabled: !!instituteId, queryKey: getGetInstituteQueryKey(instituteId) },
  });
  const { data: studentsData, isLoading: studentsLoading } = useGetInstituteStudents(instituteId, {
    query: { enabled: !!instituteId, queryKey: getGetInstituteStudentsQueryKey(instituteId) },
  });
  const testsParams = { instituteId: instituteId || undefined };
  const { data: testsData, isLoading: testsLoading } = useListTests(
    testsParams,
    { query: { enabled: !!instituteId, queryKey: getListTestsQueryKey(testsParams) } }
  );

  const students = studentsData?.users ?? [];
  const tests = testsData?.tests ?? [];

  if (instituteLoading || studentsLoading || testsLoading) {
    return <div className="text-center py-20 text-muted-foreground">Loading institute dashboard...</div>;
  }

  return (
    <div className="space-y-6" data-testid="institute-dashboard">
      <EmailVerificationBanner emailVerified={user?.emailVerified} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{institute?.name ?? "Institute Dashboard"}</h1>
          <p className="text-muted-foreground mt-1">{institute?.address}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/institute/commissions"><Wallet className="mr-2 h-4 w-4" />Commissions</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/profile"><Settings className="mr-2 h-4 w-4" />Settings</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{students.length}</p>
              <p className="text-sm text-muted-foreground">Students</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <BookOpen className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold">{tests.length}</p>
              <p className="text-sm text-muted-foreground">Tests</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-xl bg-primary/10">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-3xl font-bold capitalize">{institute?.subscriptionPlan ?? "free"}</p>
              <p className="text-sm text-muted-foreground">Current Plan</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Recent Students</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/institute/students">View all</Link>
            </Button>
          </CardHeader>
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.slice(0, 5).map(student => (
                  <TableRow key={student.id}>
                    <TableCell className="font-medium">{student.name}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{student.email}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs capitalize">{student.subscriptionPlan}</Badge></TableCell>
                  </TableRow>
                ))}
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No students yet</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between pb-3">
            <CardTitle className="text-base">Tests</CardTitle>
            <Button size="sm" asChild>
              <Link href="/institute/tests"><Plus className="mr-2 h-3.5 w-3.5" />New Test</Link>
            </Button>
          </CardHeader>
          <div className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Test Name</TableHead>
                  <TableHead>Language</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tests.slice(0, 5).map(test => (
                  <TableRow key={test.id}>
                    <TableCell className="font-medium">{test.name}</TableCell>
                    <TableCell className="capitalize text-sm text-muted-foreground">{test.language}</TableCell>
                    <TableCell><Badge variant={test.isActive ? "default" : "secondary"} className="text-xs">{test.isActive ? "Active" : "Inactive"}</Badge></TableCell>
                  </TableRow>
                ))}
                {tests.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground py-6">No tests created</TableCell>
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
