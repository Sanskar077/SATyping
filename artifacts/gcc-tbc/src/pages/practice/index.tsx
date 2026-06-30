import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateTypingSession, TypingSessionInputLanguage, useGetRandomPassage, GetRandomPassageLanguage, GetRandomPassageDifficulty } from "@workspace/api-client-react";
import { Activity, Play, Settings } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Practice() {
  const [language, setLanguage] = useState<GetRandomPassageLanguage>(GetRandomPassageLanguage.english);
  const [speedCategory, setSpeedCategory] = useState<string>("30");
  const [difficulty, setDifficulty] = useState<GetRandomPassageDifficulty>(GetRandomPassageDifficulty.easy);
  
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const createSession = useCreateTypingSession();
  
  const { data: randomPassage, refetch: fetchPassage, isFetching } = useGetRandomPassage({
    query: {
      enabled: false,
    }
  });

  const handleStart = async () => {
    try {
      // First get a passage
      const passageRes = await fetchPassage();
      const passage = passageRes.data;
      
      if (!passage) {
        toast({
          title: "No passage found",
          description: "Could not find a passage matching these settings.",
          variant: "destructive"
        });
        return;
      }
      
      // Create session
      createSession.mutate({
        data: {
          passageId: passage.id,
          language: language as any,
        }
      }, {
        onSuccess: (session) => {
          setLocation(`/practice/${session.id}`);
        },
        onError: () => {
          toast({
            title: "Error",
            description: "Failed to create practice session.",
            variant: "destructive"
          });
        }
      });
      
    } catch (err) {
      toast({
        title: "Error",
        description: "Something went wrong.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Practice Session</h1>
        <p className="text-muted-foreground mt-1">Configure your practice environment to match exam conditions.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Settings className="h-5 w-5 mr-2" />
            Session Settings
          </CardTitle>
          <CardDescription>Choose your language, target speed, and difficulty level.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-medium">Language</label>
              <Select value={language} onValueChange={(val: any) => setLanguage(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="english">English</SelectItem>
                  <SelectItem value="hindi">Hindi</SelectItem>
                  <SelectItem value="marathi">Marathi</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Speed (WPM)</label>
              <Select value={speedCategory} onValueChange={setSpeedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="30">30 WPM</SelectItem>
                  <SelectItem value="40">40 WPM</SelectItem>
                  <SelectItem value="50">50 WPM</SelectItem>
                  <SelectItem value="60">60 WPM</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Difficulty</label>
              <Select value={difficulty} onValueChange={(val: any) => setDifficulty(val)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">Easy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="hard">Hard</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
        <CardFooter className="bg-muted/50 flex justify-end">
          <Button onClick={handleStart} disabled={isFetching || createSession.isPending} size="lg">
            {(isFetching || createSession.isPending) ? "Preparing..." : (
              <>
                <Play className="h-4 w-4 mr-2" />
                Start Typing
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
