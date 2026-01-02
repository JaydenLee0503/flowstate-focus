import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
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
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);

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
    building: { label: 'Building Focus', color: 'bg-flow-low', width: '33%' },
    flowing: { label: 'In Flow', color: 'bg-flow-medium', width: '66%' },
    deep: { label: 'Deep Focus', color: 'bg-flow-high', width: '100%' },
  };

  if (!studyGoal) return null;

  return (
    <main className="min-h-screen bg-background flex flex-col px-6 py-8">
      {/* Top: Task Label */}
      <header className="text-center animate-fade-in">
        <span className="inline-block text-xs font-medium text-muted-foreground uppercase tracking-wider px-3 py-1.5 bg-secondary rounded-full">
          {goalLabels[studyGoal]} Session
        </span>
      </header>

      {/* Center: Timer & Flow Indicator */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center stagger-children">
          {/* Large Timer */}
          <div className="mb-10">
            <span className="text-7xl md:text-8xl font-light tracking-tight text-foreground tabular-nums">
              {formatTime(seconds)}
            </span>
          </div>

          {/* Flow Indicator */}
          <div className="flex flex-col items-center gap-3 mb-14">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-2.5 h-2.5 rounded-full ${flowConfig[flowLevel].color} animate-pulse-soft`}
              />
              <span className="text-sm font-medium text-foreground">
                {flowConfig[flowLevel].label}
              </span>
            </div>
            
            {/* Flow Bar */}
            <div className="w-52 h-1 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full ${flowConfig[flowLevel].color} transition-all duration-1000 ease-out`}
                style={{ width: flowConfig[flowLevel].width }}
              />
            </div>
          </div>

          {/* AI Nudge */}
          <div className="max-w-sm mx-auto px-5 py-4 bg-card rounded-xl border border-border shadow-soft">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              {currentNudge}
            </p>
          </div>
        </div>
      </div>

      {/* Bottom: End Session Button */}
      <footer className="flex justify-center pt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <button
          onClick={() => setIsEndDialogOpen(true)}
          className="px-6 py-2.5 rounded-lg text-sm font-medium text-muted-foreground bg-secondary hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
        >
          End Session
        </button>
      </footer>

      {/* End Session Confirmation Dialog */}
      <Transition appear show={isEndDialogOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsEndDialogOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-200"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-150"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-foreground/10 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-200"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-150"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-xl bg-card p-6 shadow-lg ring-1 ring-border transition-all">
                  <Dialog.Title as="h3" className="text-lg font-medium text-foreground mb-2">
                    End this session?
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground mb-6">
                    You've been studying for {formatTime(seconds)}. Ready to reflect on your session?
                  </Dialog.Description>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEndDialogOpen(false)}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-foreground bg-secondary hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      Continue
                    </button>
                    <button
                      onClick={handleEndSession}
                      className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      End Session
                    </button>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </main>
  );
};

export default Session;
