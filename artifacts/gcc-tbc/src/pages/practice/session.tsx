import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { useGetTypingSession, getGetTypingSessionQueryKey, useUpdateTypingSession, TypingSessionUpdateStatus } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AlertCircle, Clock, Activity, Target } from "lucide-react";

export default function PracticeSession() {
  const { sessionId } = useParams();
  const id = parseInt(sessionId || "0", 10);
  const [, setLocation] = useLocation();
  
  const { data: session, isLoading } = useGetTypingSession(id, {
    query: {
      enabled: !!id,
      queryKey: getGetTypingSessionQueryKey(id),
    }
  });

  const updateSession = useUpdateTypingSession();

  // Engine state
  const [typedText, setTypedText] = useState("");
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  const passageText = session?.passage?.content || "";
  
  // Start timer on first keypress
  useEffect(() => {
    if (typedText.length > 0 && !startTime && !isCompleted) {
      setStartTime(Date.now());
    }
  }, [typedText, startTime, isCompleted]);

  // Update timer
  useEffect(() => {
    if (startTime && !isCompleted) {
      const interval = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [startTime, isCompleted]);

  // Keep input focused
  useEffect(() => {
    const handleClick = () => {
      if (!isCompleted && inputRef.current) {
        inputRef.current.focus();
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [isCompleted]);

  // Auto-complete when text length matches
  useEffect(() => {
    if (passageText && typedText.length >= passageText.length && !isCompleted) {
      handleComplete();
    }
  }, [typedText, passageText, isCompleted]);

  const stats = useMemo(() => {
    if (!passageText) return { wpm: 0, accuracy: 0, progress: 0 };
    
    let correctChars = 0;
    let incorrectChars = 0;
    
    for (let i = 0; i < typedText.length; i++) {
      if (typedText[i] === passageText[i]) correctChars++;
      else incorrectChars++;
    }
    
    const minutes = elapsedSeconds / 60;
    const grossWpm = minutes > 0 ? Math.round((typedText.length / 5) / minutes) : 0;
    const netWpm = minutes > 0 ? Math.round(((correctChars / 5) - incorrectChars) / minutes) : 0;
    const accuracy = typedText.length > 0 ? Math.round((correctChars / typedText.length) * 100) : 100;
    
    return {
      grossWpm: Math.max(0, grossWpm),
      wpm: Math.max(0, netWpm),
      accuracy,
      correctChars,
      incorrectChars,
      progress: (typedText.length / passageText.length) * 100
    };
  }, [typedText, passageText, elapsedSeconds]);

  const handleComplete = useCallback(() => {
    if (isCompleted) return;
    setIsCompleted(true);
    
    updateSession.mutate({
      id,
      data: {
        status: TypingSessionUpdateStatus.completed,
        grossWpm: stats.grossWpm,
        netWpm: stats.wpm,
        accuracy: stats.accuracy,
        totalChars: typedText.length,
        correctChars: stats.correctChars,
        incorrectChars: stats.incorrectChars,
        durationSeconds: elapsedSeconds,
      }
    });
  }, [isCompleted, id, stats, typedText.length, elapsedSeconds, updateSession]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (isCompleted) return;
    
    // Prevent backspace from working natively, we handle it
    if (e.key === 'Backspace') {
      e.preventDefault();
      setTypedText(prev => prev.slice(0, -1));
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isCompleted) return;
    setTypedText(e.target.value);
  };

  if (isLoading) return <div>Loading session...</div>;
  if (!session || !passageText) return <div>Session not found</div>;

  if (session.status === 'completed' || isCompleted) {
    return (
      <div className="max-w-3xl mx-auto space-y-6 mt-12">
        <Card className="border-primary">
          <CardHeader className="text-center bg-primary/5 pb-8">
            <CardTitle className="text-2xl font-bold">Session Completed</CardTitle>
          </CardHeader>
          <CardContent className="pt-8">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
              <div>
                <p className="text-muted-foreground text-sm font-medium">Net WPM</p>
                <p className="text-4xl font-bold text-primary">{stats.wpm}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Accuracy</p>
                <p className="text-4xl font-bold">{stats.accuracy}%</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Time</p>
                <p className="text-4xl font-bold">{Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}</p>
              </div>
              <div>
                <p className="text-muted-foreground text-sm font-medium">Errors</p>
                <p className="text-4xl font-bold text-destructive">{stats.incorrectChars}</p>
              </div>
            </div>
            
            <div className="mt-12 flex justify-center gap-4">
              <Button onClick={() => setLocation("/dashboard")} variant="outline">Back to Dashboard</Button>
              <Button onClick={() => setLocation("/practice")}>Practice Again</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render passage with colors
  const renderText = () => {
    return passageText.split('').map((char, index) => {
      let colorClass = "text-muted-foreground";
      let bgClass = "";
      
      if (index < typedText.length) {
        if (typedText[index] === char) {
          colorClass = "text-green-600 dark:text-green-400";
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
        <div className="flex gap-8">
          <div className="flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            <div className="text-2xl font-bold font-mono w-16">{stats.wpm} <span className="text-sm text-muted-foreground font-sans">WPM</span></div>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <div className="text-2xl font-bold font-mono w-16">{stats.accuracy}%</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-xl font-mono">
          <Clock className="h-5 w-5 text-muted-foreground" />
          {Math.floor(elapsedSeconds / 60)}:{String(elapsedSeconds % 60).padStart(2, '0')}
        </div>
      </div>
      
      <Progress value={stats.progress} className="h-2" />

      <Card className="shadow-lg border-2">
        <CardContent className="p-8 min-h-[400px]">
          {/* Hidden input to capture all typing */}
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
      
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <div className="flex items-center gap-1">
          <AlertCircle className="h-4 w-4" />
          Start typing to begin. Click the text area to focus.
        </div>
        <Button variant="ghost" onClick={handleComplete}>End Session Early</Button>
      </div>
    </div>
  );
}
