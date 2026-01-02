import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession } from '@/context/SessionContext';

const goalLabels: Record<string, string> = {
  reading: 'Reading / Review',
  'problem-solving': 'Problem Solving',
  memorization: 'Memorization',
};

// TODO: Replace with actual AI-generated nudges based on posture/attention signals
const placeholderNudges = [
  "You're doing well. Stay relaxed and upright.",
  "Take a deep breath. You're making progress.",
  "Great focus. Keep your shoulders relaxed.",
  "Remember to blink and rest your eyes briefly.",
];

const Session = () => {
  const navigate = useNavigate();
  const { studyGoal, energyLevel, setSessionDuration } = useSession();
  const [seconds, setSeconds] = useState(0);
  const [flowLevel, setFlowLevel] = useState<'building' | 'flowing' | 'deep'>('building');
  const [currentNudge, setCurrentNudge] = useState(placeholderNudges[0]);

  // Redirect if no session data
  useEffect(() => {
    if (!studyGoal || !energyLevel) {
      navigate('/');
    }
  }, [studyGoal, energyLevel, navigate]);

  // Timer
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // TODO: Replace with actual AI flow detection
  // Simulated flow state progression
  useEffect(() => {
    if (seconds >= 300) {
      setFlowLevel('deep');
    } else if (seconds >= 120) {
      setFlowLevel('flowing');
    } else {
      setFlowLevel('building');
    }
  }, [seconds]);

  // Rotate nudges periodically
  // TODO: Replace with real-time AI nudges based on sensor data
  useEffect(() => {
    const interval = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * placeholderNudges.length);
      setCurrentNudge(placeholderNudges[randomIndex]);
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  const formatTime = useCallback((totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleEndSession = () => {
    setSessionDuration(seconds);
    navigate('/reflection');
  };

  const flowConfig = {
    building: { label: 'Building Focus', color: 'bg-flow-low' },
    flowing: { label: 'In Flow', color: 'bg-flow-medium' },
    deep: { label: 'Deep Focus', color: 'bg-flow-high' },
  };

  if (!studyGoal) return null;

  return (
    <main className="min-h-screen bg-background flex flex-col px-6 py-8">
      {/* Top: Task Label */}
      <header className="text-center animate-fade-in">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
          {goalLabels[studyGoal]} Session
        </span>
      </header>

      {/* Center: Timer & Flow Indicator */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center stagger-children">
          {/* Large Timer */}
          <div className="mb-8">
            <span className="text-7xl md:text-8xl font-light tracking-tight text-foreground tabular-nums">
              {formatTime(seconds)}
            </span>
          </div>

          {/* Flow Indicator */}
          <div className="flex flex-col items-center gap-3 mb-12">
            <div className="flex items-center gap-2">
              <div
                className={`w-3 h-3 rounded-full ${flowConfig[flowLevel].color} animate-pulse-soft`}
              />
              <span className="text-sm font-medium text-foreground">
                {flowConfig[flowLevel].label}
              </span>
            </div>
            
            {/* Flow Bar */}
            <div className="w-48 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${flowConfig[flowLevel].color} transition-all duration-1000 ease-out`}
                style={{
                  width: flowLevel === 'building' ? '33%' : flowLevel === 'flowing' ? '66%' : '100%',
                }}
              />
            </div>
          </div>

          {/* AI Nudge */}
          <div className="max-w-sm mx-auto px-6 py-4 bg-accent/50 rounded-2xl border border-border">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {currentNudge}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: End Session Button */}
      <footer className="flex justify-center pt-8 animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <Button
          variant="subtle"
          size="lg"
          onClick={handleEndSession}
        >
          End Session
        </Button>
      </footer>
    </main>
  );
};

export default Session;
