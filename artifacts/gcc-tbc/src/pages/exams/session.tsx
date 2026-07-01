import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetTestAttempt, getGetTestAttemptQueryKey, useSubmitTestAttempt, useCreateTestAttempt, TestAttemptSubmitStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function ExamSession() {
  const { testId } = useParams();
  const id = parseInt(testId || "0", 10);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  const [attemptId, setAttemptId] = useState<number | null>(null);
  
  const createAttempt = useCreateTestAttempt();
  const submitAttempt = useSubmitTestAttempt();

  const { data: attempt, isLoading } = useGetTestAttempt(attemptId || 0, {
    query: {
      enabled: !!attemptId,
      queryKey: getGetTestAttemptQueryKey(attemptId || 0),
    }
  });

  // Engine state
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  const test = attempt?.test;
  const passageText = attempt?.passage?.content || "";

  const handleBegin = () => {
    createAttempt.mutate({
      data: { testId: id }
    }, {
      onSuccess: (data) => {
        setAttemptId(data.id);
        setHasStarted(true);
        setStartTime(Date.now());
        setTimeRemaining((data.test?.durationMinutes || 5) * 60);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to start exam", variant: "destructive" });
      }
    });
  };

  // Update timer
  useEffect(() => {
    if (hasStarted && !isCompleted && timeRemaining > 0) {
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            handleComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [hasStarted, isCompleted, timeRemaining]);

  // Keep input focused
  useEffect(() => {
    const handleClick = () => {
      if (hasStarted && !isCompleted && inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [hasStarted, isCompleted]);

  // Auto-complete when text length matches
  useEffect(() => {
    if (passageText && typedText.length >= passageText.length && !isCompleted) {
      handleComplete();
    }
  }, [typedText, passageText, isCompleted]);

  const stats = useMemo(() => {
    if (!passageText) return { grossWpm: 0, wpm: 0, accuracy: 0, correctChars: 0, incorrectChars: 0 };
    
    let correctChars = 0;
    let incorrectChars = 0;
    
    for (let i = 0; i < typedText.length; i++) {
      if (typedText[i] === passageText[i]) correctChars++;
      else incorrectChars++;
    }
    
    const durationMins = test?.durationMinutes || 5;
    const elapsedMins = (durationMins * 60 - timeRemaining) / 60;
    const effectiveMins = elapsedMins > 0 ? elapsedMins : durationMins;
    
    const grossWpm = Math.round((typedText.length / 5) / effectiveMins);
    const netWpm = Math.round(((correctChars / 5) - incorrectChars) / effectiveMins);
    const accuracy = typedText.length > 0 ? Math.round((correctChars / typedText.length) * 100) : 100;
    
    return {
      grossWpm: Math.max(0, grossWpm),
      wpm: Math.max(0, netWpm),
      accuracy,
      correctChars,
      incorrectChars,
    };
  }, [typedText, passageText, timeRemaining, test?.durationMinutes]);

  const handleComplete = useCallback(() => {
    if (isCompleted || !attemptId) return;
    setIsCompleted(true);
    
    const durationSecs = (test?.durationMinutes || 5) * 60 - timeRemaining;
    
    submitAttempt.mutate({
      id: attemptId,
      data: {
        status: timeRemaining <= 0 ? TestAttemptSubmitStatus.timed_out : TestAttemptSubmitStatus.completed,
        grossWpm: stats.grossWpm,
        netWpm: stats.wpm,
        accuracy: stats.accuracy,
        totalChars: typedText.length,
        correctChars: stats.correctChars,
        incorrectChars: stats.incorrectChars,
        durationSeconds: durationSecs,
      }
    }, {
      onSuccess: () => {
        toast({ title: "Exam Submitted", description: "Your results have been recorded." });
        setLocation(`/results`);
      }
    });
  }, [isCompleted, attemptId, timeRemaining, stats, typedText.length, test?.durationMinutes, submitAttempt, setLocation, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCompleted) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      setTypedText(prev => prev.slice(0, -1));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCompleted) return;
    setTypedText(e.target.value);
  };

  if (!hasStarted) {
    return (
      <div className="max-w-2xl mx-auto mt-12">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Start Exam</CardTitle>
            <CardDescription>Please read the instructions carefully before beginning.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-md flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Exam Conditions</p>
                <ul className="list-disc pl-5 mt-2 space-y-1 text-sm text-muted-foreground">
                  <li>The timer cannot be paused once started.</li>
                  <li>Do not refresh the page or you will lose your attempt.</li>
                  <li>Backspace is allowed but counts towards errors.</li>
                  <li>Submit early if you finish the passage before time runs out.</li>
                </ul>
              </div>
            </div>
            <Button onClick={handleBegin} disabled={createAttempt.isPending} size="lg" className="w-full mt-4">
              {createAttempt.isPending ? "Preparing Exam..." : "I am ready. Start Exam"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading || !attempt || !passageText) return <div>Loading exam data...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isLowTime = timeRemaining < 60;

  // Render passage with colors
  const renderText = () => {
    return passageText.split('').map((char, index) => {
      let colorClass = "text-muted-foreground";
      let bgClass = "";
      
      if (index < typedText.length) {
        if (typedText[index] === char) {
          colorClass = "text-foreground font-medium";
        } else {
          colorClass = "text-destructive-foreground";
          bgClass = "bg-destructive/80";
        }
      } else if (index === typedText.length) {
        bgClass = "bg-primary/20 border-b-2 border-primary";
        colorClass = "text-foreground";
      }

      return (
        <span key={index} className={`${colorClass} ${bgClass} rounded-sm px-[1px] font-mono text-xl leading-relaxed whitespace-pre-wrap`}>
          {char}
        </span>
      );
    });
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between bg-card p-4 rounded-lg border shadow-sm sticky top-0 z-10">
        <div>
          <h2 className="font-bold">{test?.name}</h2>
          <p className="text-sm text-muted-foreground">{test?.language} • {test?.speedCategory} WPM</p>
        </div>
        
        <div className={`flex items-center gap-2 text-2xl font-mono font-bold ${isLowTime ? 'text-destructive animate-pulse' : 'text-primary'}`}>
          <Clock className="h-6 w-6" />
          {formatTime(timeRemaining)}
        </div>
      </div>
      
      <Card className="shadow-lg border-2">
        <CardContent className="p-8 min-h-[400px]">
          <input
            ref={inputRef}
            type="text"
            className="opacity-0 absolute inset-0 -z-10 h-0 w-0"
            value={typedText}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          
          <div className="select-none" onClick={() => inputRef.current?.focus()}>
            {renderText()}
          </div>
        </CardContent>
      </Card>
      
      <div className="flex justify-end">
        <Button onClick={handleComplete} disabled={submitAttempt.isPending} variant="secondary">
          Submit Exam
        </Button>
      </div>
    </div>
  );
}
