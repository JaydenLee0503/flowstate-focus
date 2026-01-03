import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

export type StudyGoal = 'reading' | 'problem-solving' | 'memorization' | null;
export type EnergyLevel = 'low' | 'medium' | 'high' | null;

interface SessionState {
  studyGoal: StudyGoal;
  energyLevel: EnergyLevel;
  plannedDuration: number; // in minutes (user selection)
  sessionDuration: number; // in seconds (actual elapsed time)
  focusScores: number[]; // array of focus scores (0-1) captured during session
  averageFocusScore: number; // calculated average (0-1)
  setStudyGoal: (goal: StudyGoal) => void;
  setEnergyLevel: (level: EnergyLevel) => void;
  setPlannedDuration: (duration: number) => void;
  setSessionDuration: (duration: number) => void;
  addFocusScore: (score: number) => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [studyGoal, setStudyGoal] = useState<StudyGoal>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(null);
  const [plannedDuration, setPlannedDuration] = useState(25); // default 25 min
  const [sessionDuration, setSessionDuration] = useState(0);
  const [focusScores, setFocusScores] = useState<number[]>([]);

  // Calculate average focus score with harsher weighting
  const calculateAverageFocus = useCallback((scores: number[]): number => {
    if (scores.length === 0) return 0;
    
    // Apply harsher scoring: penalize low scores more
    const harshScores = scores.map(score => {
      // Square the score to make low scores much lower
      // e.g., 0.5 becomes 0.25, 0.7 becomes 0.49
      return Math.pow(score, 1.5);
    });
    
    const sum = harshScores.reduce((acc, s) => acc + s, 0);
    return sum / harshScores.length;
  }, []);

  const averageFocusScore = calculateAverageFocus(focusScores);

  const addFocusScore = useCallback((score: number) => {
    setFocusScores(prev => [...prev, score]);
  }, []);

  const resetSession = () => {
    setStudyGoal(null);
    setEnergyLevel(null);
    setPlannedDuration(25);
    setSessionDuration(0);
    setFocusScores([]);
  };

  return (
    <SessionContext.Provider
      value={{
        studyGoal,
        energyLevel,
        plannedDuration,
        sessionDuration,
        focusScores,
        averageFocusScore,
        setStudyGoal,
        setEnergyLevel,
        setPlannedDuration,
        setSessionDuration,
        addFocusScore,
        resetSession,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
