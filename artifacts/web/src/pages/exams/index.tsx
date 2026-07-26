import { useState } from "react";
import { Link } from "wouter";
import { useListTests } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Search, Clock, FileText, ChevronRight } from "lucide-react";

export default function Exams() {
  const { data: testRes, isLoading } = useListTests();

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Available Exams</h1>
          <p className="text-muted-foreground mt-1">Official mock tests and institutional assessments.</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input type="search" placeholder="Search exams..." className="pl-9" />
        </div>
      </div>

      {isLoading ? (
        <div>Loading exams...</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {testRes?.tests.map((test) => (
            <Card key={test.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="mb-2 bg-primary/5 text-primary border-primary/20">
                      {test.language.charAt(0).toUpperCase() + test.language.slice(1)} • {test.speedCategory} WPM
                    </Badge>
                    <CardTitle className="text-xl">{test.name}</CardTitle>
                  </div>
                </div>
                <CardDescription className="line-clamp-2 mt-2">{test.description}</CardDescription>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    {test.durationMinutes} mins
                  </div>
                  <div className="flex items-center">
                    <FileText className="h-4 w-4 mr-1" />
                    Min. {test.minAccuracy || 90}% Acc
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button asChild className="w-full">
                  <Link href={`/exam/${test.id}`}>
                    Start Exam <ChevronRight className="h-4 w-4 ml-1" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
          {testRes?.tests.length === 0 && (
            <div className="col-span-2 text-center py-12 text-muted-foreground border rounded-lg bg-card">
              No exams currently available.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
