/**
 * useStartPracticeSession — the one way a practice session gets created.
 *
 * Fetch a passage matching the settings → create the typing session → persist the timing config
 * for the session page → remember the settings for "practice again" → navigate.
 *
 * Shared by the setup wizard's Start button AND the results screen's "Next passage" button, so
 * the two paths can never drift (same passage selection, same config handoff, same bookkeeping).
 */
import { useState } from "react";
import { useLocation } from "wouter";
import {
  getRandomPassage, createTypingSession,
  GetRandomPassageDifficulty, type GetRandomPassageLanguage,
} from "@workspace/api-client-react";
import { useToast } from "@/hooks/use-toast";
import { writePracticeConfig, writeLastSettings, type LastPracticeSettings } from "@/lib/practice-config";

export function useStartPracticeSession() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isStarting, setIsStarting] = useState(false);

  const start = async (settings: LastPracticeSettings, opts?: { excludePassageId?: number }) => {
    if (isStarting) return;
    setIsStarting(true);
    try {
      // Grab a passage for the tier. If it's the one just typed, retry once for variety —
      // best-effort only, since a tier can legitimately contain a single passage.
      let passage = await getRandomPassage({
        language: settings.language as GetRandomPassageLanguage,
        speedCategory: settings.speedCategory,
        difficulty: GetRandomPassageDifficulty.easy,
      });
      if (opts?.excludePassageId !== undefined && passage.id === opts.excludePassageId) {
        const retry = await getRandomPassage({
          language: settings.language as GetRandomPassageLanguage,
          speedCategory: settings.speedCategory,
          difficulty: GetRandomPassageDifficulty.easy,
        });
        if (retry.id !== opts.excludePassageId) passage = retry;
      }

      const session = await createTypingSession({
        passageId: passage.id,
        language: settings.language,
      });

      writePracticeConfig(session.id, {
        isTimed: settings.isTimed,
        durationMinutes: settings.durationMinutes,
        speedCategory: settings.speedCategory,
      });
      writeLastSettings(settings);
      setLocation(`/practice/${session.id}`);
    } catch (err) {
      const msg = (err as { data?: { error?: string } })?.data?.error
        ?? "Could not start a practice session. Please try again.";
      toast({ title: "Couldn't start practice", description: msg, variant: "destructive" });
    } finally {
      setIsStarting(false);
    }
  };

  return { start, isStarting };
}
