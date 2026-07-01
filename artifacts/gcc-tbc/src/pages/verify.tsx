import { useVerifyCertificate, getVerifyCertificateQueryKey } from "@workspace/api-client-react";
import { useParams, Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Award, CheckCircle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function VerifyCertificate() {
  const { verificationId } = useParams<{ verificationId: string }>();

  const { data, isLoading, isError } = useVerifyCertificate(verificationId, {
    query: { enabled: !!verificationId, queryKey: getVerifyCertificateQueryKey(verificationId) },
  });

  const cert = data?.certificate;
  const langLabel: Record<string, string> = {
    english: "English", hindi: "Hindi", marathi: "Marathi",
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-lg w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-3">
            <Award className="h-10 w-10 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">SATyping</h1>
          <p className="text-muted-foreground text-sm mt-1">Certificate Verification</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : isError || !cert ? (
          <div className="text-center py-12 border rounded-xl bg-destructive/5">
            <XCircle className="mx-auto h-12 w-12 text-destructive mb-3" />
            <h2 className="text-lg font-semibold text-destructive">Certificate Not Found</h2>
            <p className="text-muted-foreground text-sm mt-2">
              This verification ID is invalid or the certificate does not exist.
            </p>
          </div>
        ) : (
          <div className="border-2 border-primary/20 rounded-2xl bg-card p-8 text-center shadow-lg" data-testid="verified-cert">
            <div className="flex justify-center mb-3">
              <div className="p-3 rounded-full bg-green-100 dark:bg-green-900/20">
                <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
            </div>
            <p className="text-sm font-semibold text-green-600 dark:text-green-400 uppercase tracking-widest mb-4">Verified Certificate</p>
            <h2 className="text-2xl font-bold">{cert.userName}</h2>
            {cert.instituteName && (
              <p className="text-sm text-muted-foreground mt-1">{cert.instituteName}</p>
            )}
            <p className="text-muted-foreground text-sm mt-3 mb-5">
              Successfully demonstrated typing proficiency
            </p>
            <div className="flex justify-center gap-6 mb-5">
              <div>
                <p className="text-3xl font-black font-mono text-primary">{Math.round(cert.netWpm)}</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">WPM</p>
              </div>
              <div className="w-px bg-border" />
              <div>
                <p className="text-3xl font-black font-mono text-primary">{Math.round(cert.accuracy)}%</p>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Accuracy</p>
              </div>
            </div>
            <Badge variant="secondary" className="capitalize mb-4">
              {langLabel[cert.language] ?? cert.language} Typing
            </Badge>
            <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
              <p>Certificate No: <span className="font-mono font-semibold">{cert.certificateNumber}</span></p>
              <p>Issued: {new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <Button variant="ghost" asChild>
            <Link href="/">Back to SATyping</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
