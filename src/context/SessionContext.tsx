import React, { createContext, useContext, useState, ReactNode } from 'react';

export type StudyGoal = 'reading' | 'problem-solving' | 'memorization' | null;
export type EnergyLevel = 'low' | 'medium' | 'high' | null;

interface SessionState {
  studyGoal: StudyGoal;
  energyLevel: EnergyLevel;
  sessionDuration: number; // in seconds
  setStudyGoal: (goal: StudyGoal) => void;
  setEnergyLevel: (level: EnergyLevel) => void;
  setSessionDuration: (duration: number) => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [studyGoal, setStudyGoal] = useState<StudyGoal>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(null);
  const [sessionDuration, setSessionDuration] = useState(0);

  const resetSession = () => {
    setStudyGoal(null);
    setEnergyLevel(null);
    setSessionDuration(0);
  };

  return (
    <SessionContext.Provider
      value={{
        studyGoal,
        energyLevel,
        sessionDuration,
        setStudyGoal,
        setEnergyLevel,
        setSessionDuration,
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
