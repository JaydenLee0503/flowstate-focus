import React, { createContext, useContext, useState, ReactNode } from 'react';

export type StudyGoal = 'reading' | 'problem-solving' | 'memorization' | null;
export type EnergyLevel = 'low' | 'medium' | 'high' | null;

interface SessionState {
  studyGoal: StudyGoal;
  energyLevel: EnergyLevel;
  plannedDuration: number; // in minutes (user selection)
  sessionDuration: number; // in seconds (actual elapsed time)
  setStudyGoal: (goal: StudyGoal) => void;
  setEnergyLevel: (level: EnergyLevel) => void;
  setPlannedDuration: (duration: number) => void;
  setSessionDuration: (duration: number) => void;
  resetSession: () => void;
}

const SessionContext = createContext<SessionState | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [studyGoal, setStudyGoal] = useState<StudyGoal>(null);
  const [energyLevel, setEnergyLevel] = useState<EnergyLevel>(null);
  const [plannedDuration, setPlannedDuration] = useState(25); // default 25 min
  const [sessionDuration, setSessionDuration] = useState(0);

  const resetSession = () => {
    setStudyGoal(null);
    setEnergyLevel(null);
    setPlannedDuration(25);
    setSessionDuration(0);
  };

  return (
    <SessionContext.Provider
      value={{
        studyGoal,
        energyLevel,
        plannedDuration,
        sessionDuration,
        setStudyGoal,
        setEnergyLevel,
        setPlannedDuration,
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
