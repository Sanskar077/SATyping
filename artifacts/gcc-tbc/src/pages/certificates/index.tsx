import { useListCertificates, useGenerateCertificate, getListCertificatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Award, ExternalLink, Calendar, Zap, Target } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function Certificates() {
  const { data, isLoading } = useListCertificates();
  const queryClient = useQueryClient();

  const langLabel: Record<string, string> = {
    english: "English", hindi: "Hindi", marathi: "Marathi",
  };

  return (
    <div className="space-y-6" data-testid="certificates-page">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Certificates</h1>
        <p className="text-muted-foreground mt-1">Your earned typing speed certificates.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : !data?.certificates.length ? (
        <div className="text-center py-20 text-muted-foreground">
          <Award className="mx-auto mb-4 h-12 w-12 opacity-30" />
          <p className="text-lg font-medium">No certificates yet</p>
          <p className="text-sm mt-1">Pass a typing test to earn your first certificate.</p>
          <Button asChild className="mt-4">
            <Link href="/exams">Browse Exams</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.certificates.map((cert) => (
            <Card key={cert.id} className="relative overflow-hidden" data-testid={`card-certificate-${cert.id}`}>
              <div className="absolute top-0 left-0 right-0 h-1 bg-primary" />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Award className="h-6 w-6 text-primary" />
                  </div>
                  <Badge variant="secondary" className="capitalize text-xs">
                    {langLabel[cert.language] ?? cert.language}
                  </Badge>
                </div>
                <CardTitle className="text-lg mt-3">
                  Typing Speed Certificate
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {cert.certificateNumber}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="flex items-center gap-1.5">
                    <Zap className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono font-bold">{Math.round(cert.netWpm)} WPM</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-primary" />
                    <span className="font-mono font-bold">{Math.round(cert.accuracy)}%</span>
                  </div>
                  <div className="flex items-center gap-1.5 col-span-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full" asChild>
                  <Link href={`/certificates/${cert.id}`}>
                    <ExternalLink className="mr-2 h-3.5 w-3.5" />
                    View Certificate
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
