import { useListResults } from "@workspace/api-client-react";
import { Link } from "wouter";
import {
  Table,
  Body,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function Results() {
  const { data, isLoading } = useListResults();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Test Results</h1>
        <p className="text-muted-foreground mt-1">History of all your completed exams.</p>
      </div>

      <div className="rounded-md border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Test Name</TableHead>
              <TableHead>Language</TableHead>
              <TableHead className="text-right">Net WPM</TableHead>
              <TableHead className="text-right">Accuracy</TableHead>
              <TableHead>Status</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          {/* Workaround for TableBody missing export in simple UI setup */}
          <tbody className="[&_tr:last-child]:border-0">
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">Loading results...</TableCell>
              </TableRow>
            ) : data?.results.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No test results found.</TableCell>
              </TableRow>
            ) : (
              data?.results.map((result) => (
                <TableRow key={result.id}>
                  <TableCell>{new Date(result.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium">{result.testName}</TableCell>
                  <TableCell className="capitalize">{result.language}</TableCell>
                  <TableCell className="text-right font-mono font-bold">{result.netWpm}</TableCell>
                  <TableCell className="text-right font-mono">{result.accuracy}%</TableCell>
                  <TableCell>
                    <Badge variant={result.passed ? "default" : "destructive"}>
                      {result.passed ? "PASSED" : "FAILED"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" asChild>
                      {/* TODO: Add detailed result page */}
                      <Link href={`/results/${result.id}`}>View Details</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
}
