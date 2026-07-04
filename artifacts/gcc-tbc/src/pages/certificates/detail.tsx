import { useGetCertificate, getGetCertificateQueryKey } from "@workspace/api-client-react";
import { Link, useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Award, ArrowLeft, Share2, CheckCircle } from "lucide-react";

export default function CertificateDetail() {
  const { id } = useParams<{ id: string }>();
  const certId = parseInt(id, 10);

  const { data: cert, isLoading } = useGetCertificate(certId, {
    query: { enabled: !!certId, queryKey: getGetCertificateQueryKey(certId) },
  });

  const langLabel: Record<string, string> = {
    english: "English", hindi: "Hindi", marathi: "Marathi",
  };

  const verifyUrl = `${window.location.origin}/verify/${cert?.verificationId}`;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  if (!cert) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Certificate not found.</p>
        <Button asChild className="mt-4"><Link href="/certificates">Back to Certificates</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/certificates"><ArrowLeft className="mr-2 h-4 w-4" />Back</Link>
        </Button>
      </div>

      {/* Certificate */}
      <div className="relative rounded-2xl border-2 border-primary/20 bg-card p-8 text-center shadow-lg overflow-hidden" data-testid={`cert-card-${cert.id}`}>
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-primary via-primary/80 to-accent-foreground" />
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary/80 to-accent-foreground" />

        <div className="flex justify-center mb-4">
          <div className="p-4 rounded-full bg-primary/10">
            <Award className="h-12 w-12 text-primary" />
          </div>
        </div>

        <p className="text-sm text-muted-foreground uppercase tracking-widest font-medium mb-1">Certificate of Achievement</p>
        <h1 className="text-2xl font-bold mb-1">GCC-TBC Pro</h1>
        <p className="text-sm text-muted-foreground mb-6">This certifies that</p>

        <h2 className="text-3xl font-bold text-primary mb-1">{cert.userName}</h2>
        {cert.instituteName && (
          <p className="text-sm text-muted-foreground mb-4">{cert.instituteName}</p>
        )}

        <p className="text-muted-foreground mb-6">
          has successfully achieved a typing speed of
        </p>

        <div className="flex justify-center gap-8 mb-6">
          <div>
            <p className="text-4xl font-black font-mono text-primary">{Math.round(cert.netWpm)}</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">WPM</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-4xl font-black font-mono text-primary">{Math.round(cert.accuracy)}%</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Accuracy</p>
          </div>
          <div className="w-px bg-border" />
          <div>
            <p className="text-4xl font-black font-mono text-primary">{cert.speedCategory}</p>
            <p className="text-sm text-muted-foreground uppercase tracking-wider mt-1">Speed Cat.</p>
          </div>
        </div>

        <div className="flex justify-center gap-2 mb-6">
          <Badge variant="secondary" className="capitalize">{langLabel[cert.language] ?? cert.language} Typing</Badge>
        </div>

        <div className="border-t pt-4 text-xs text-muted-foreground space-y-1">
          <p>Certificate No: <span className="font-mono font-semibold">{cert.certificateNumber}</span></p>
          <p>Issued: {new Date(cert.issuedAt).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p>Verification ID: <span className="font-mono">{cert.verificationId}</span></p>
        </div>
      </div>

      <div className="flex gap-3 justify-center">
        <Button variant="outline" onClick={() => navigator.clipboard.writeText(verifyUrl)}>
          <Share2 className="mr-2 h-4 w-4" />
          Copy Verify Link
        </Button>
        <Button asChild variant="outline">
          <Link href={`/verify/${cert.verificationId}`}>
            <CheckCircle className="mr-2 h-4 w-4" />
            Verify Certificate
          </Link>
        </Button>
      </div>
    </div>
  );
}
