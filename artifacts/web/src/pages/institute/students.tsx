import { useGetInstituteStudents, getGetInstituteStudentsQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { PageLoading } from "@/components/page-loading";
import { Search, Users } from "lucide-react";

export default function InstituteStudents() {
  const { user } = useAuth();
  const instituteId = user?.instituteId ?? 0;
  const [search, setSearch] = useState("");

  const { data, isLoading } = useGetInstituteStudents(instituteId, {
    query: {
      enabled: !!instituteId,
      queryKey: getGetInstituteStudentsQueryKey(instituteId),
    },
  });

  const students = (data?.users ?? []).filter(s =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6" data-testid="institute-students-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Students</h1>
        <p className="text-muted-foreground mt-1">Students enrolled in your institute</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search by name or email..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading ? (
        <PageLoading label="Loading students..." />
      ) : students.length === 0 ? (
        <div className="text-center py-16">
          <Users className="mx-auto h-12 w-12 opacity-30 mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">{search ? "No students match your search." : "No students enrolled yet."}</p>
        </div>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students.map(student => (
                <TableRow key={student.id}>
                  <TableCell className="font-medium">{student.name}</TableCell>
                  <TableCell className="text-muted-foreground">{student.email}</TableCell>
                  <TableCell className="text-muted-foreground">{student.phone ?? "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize text-xs">{student.subscriptionPlan}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={student.isActive ? "default" : "secondary"} className="text-xs">
                      {student.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
