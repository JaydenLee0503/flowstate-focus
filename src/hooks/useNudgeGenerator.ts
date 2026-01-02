import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * useNudgeGenerator Hook
 * 
 * Generates LLM-powered nudges based on attention/posture state changes.
 * This is a COMMUNICATION LAYER - the decision logic (isDistracted) comes from the caller.
 * 
 * Features:
 * - Only calls LLM when distraction state CHANGES (not continuously)
 * - Graceful fallback to static messages if LLM fails
 * - Debounced to prevent excessive API calls
 */

// Static fallbacks when LLM is unavailable
const FALLBACK_MESSAGES = {
  distracted: "It looks like your posture dipped a bit—want to reset comfortably before continuing?",
  focused: "Nice focus so far. Staying relaxed can help you keep this momentum."
};

interface UseNudgeGeneratorProps {
  isDistracted: boolean;
  studyGoal: string | null;
  energyLevel: string | null;
}

export function useNudgeGenerator({ isDistracted, studyGoal, energyLevel }: UseNudgeGeneratorProps) {
  const [nudge, setNudge] = useState<string>(FALLBACK_MESSAGES.focused);
  const [isLoading, setIsLoading] = useState(false);
  
  // Track previous distraction state to detect changes
  const prevDistractedRef = useRef<boolean | null>(null);
  const debounceTimerRef = useRef<number | null>(null);
  
  const generateNudge = useCallback(async (distracted: boolean) => {
    setIsLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('generate-nudge', {
        body: { 
          isDistracted: distracted, 
          studyGoal: studyGoal || 'general study',
          energyLevel: energyLevel || 'medium'
        }
      });
      
      if (error) {
        console.error('Nudge generation error:', error);
        setNudge(distracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused);
        return;
      }
      
      if (data?.nudge) {
        setNudge(data.nudge);
      } else {
        setNudge(distracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused);
      }
    } catch (err) {
      console.error('Failed to generate nudge:', err);
      setNudge(distracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused);
    } finally {
      setIsLoading(false);
    }
  }, [studyGoal, energyLevel]);
  
  // Only generate new nudge when distraction state CHANGES
  useEffect(() => {
    // Skip initial render
    if (prevDistractedRef.current === null) {
      prevDistractedRef.current = isDistracted;
      // Generate initial nudge
      generateNudge(isDistracted);
      return;
    }
    
    // Only trigger on state change
    if (prevDistractedRef.current !== isDistracted) {
      prevDistractedRef.current = isDistracted;
      
      // Debounce to prevent rapid-fire calls
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      debounceTimerRef.current = window.setTimeout(() => {
        generateNudge(isDistracted);
      }, 1000); // 1 second debounce
    }
    
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [isDistracted, generateNudge]);
  
  return { nudge, isLoading };
}
