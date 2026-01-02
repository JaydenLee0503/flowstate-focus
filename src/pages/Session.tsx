import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useSession } from '@/context/SessionContext';
import { usePostureDetection } from '@/hooks/usePostureDetection';

const goalLabels: Record<string, string> = {
  reading: 'Reading / Review',
  'problem-solving': 'Problem Solving',
  memorization: 'Memorization',
};

const Session = () => {
  const navigate = useNavigate();
  const { studyGoal, energyLevel, setSessionDuration } = useSession();
  const [seconds, setSeconds] = useState(0);
  const [flowLevel, setFlowLevel] = useState<'building' | 'flowing' | 'deep'>('building');
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  
  // AI-powered attention/posture detection (MediaPipe with fallback)
  const { 
    postureScore, 
    isDistracted, 
    isUsingCamera, 
    isLoading: isCameraLoading,
    startCamera, 
    stopCamera 
  } = usePostureDetection();
  
  // Generate AI suggestion based on posture/attention signals
  const aiSuggestion = isDistracted
    ? "You might be slouching a bit—try a gentle posture reset."
    : "Nice work. Stay relaxed and upright.";

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
    building: { label: 'Building Focus', color: 'bg-flow-low', barColor: 'from-flow-low to-flow-medium', width: '33%' },
    flowing: { label: 'In Flow', color: 'bg-flow-medium', barColor: 'from-flow-medium to-flow-high', width: '66%' },
    deep: { label: 'Deep Focus', color: 'bg-flow-high', barColor: 'from-flow-high to-primary', width: '100%' },
  };

  if (!studyGoal) return null;

  return (
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10 flex flex-col px-6 py-8">
      {/* Top: Task Label */}
      <header className="text-center animate-fade-in">
        <span className="inline-block text-xs font-semibold text-primary uppercase tracking-wider px-4 py-2 bg-accent rounded-full border border-primary/20">
          {goalLabels[studyGoal]} Session
        </span>
      </header>

      {/* Center: Timer & Flow Indicator */}
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-center stagger-children">
          {/* Large Timer */}
          <div className="mb-8">
            <span className="text-8xl md:text-9xl font-extralight tracking-tight text-foreground tabular-nums">
              {formatTime(seconds)}
            </span>
          </div>

          {/* Flow Indicator */}
          <div className="flex flex-col items-center gap-4 mb-12">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${flowConfig[flowLevel].color} animate-pulse-soft shadow-lg`}
                style={{ boxShadow: `0 0 12px 2px hsl(var(--flow-${flowLevel === 'deep' ? 'high' : flowLevel}))` }}
              />
              <span className="text-sm font-semibold text-foreground">
                {flowConfig[flowLevel].label}
              </span>
            </div>
            
            {/* Flow Bar */}
            <div className="w-56 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${flowConfig[flowLevel].barColor} transition-all duration-1000 ease-out rounded-full`}
                style={{ width: flowConfig[flowLevel].width }}
              />
            </div>
          </div>

          {/* AI Nudge */}
          <div className="max-w-sm mx-auto px-6 py-5 bg-card rounded-2xl border border-border shadow-medium">
            <p className="text-sm text-muted-foreground text-center leading-relaxed">
              "{aiSuggestion}"
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <div className="text-xs text-muted-foreground">Posture:</div>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${postureScore > 0.6 ? 'bg-flow-high' : postureScore > 0.3 ? 'bg-flow-medium' : 'bg-destructive'}`}
                  style={{ width: `${postureScore * 100}%` }}
                />
              </div>
            </div>
            
            {/* Camera Toggle - Optional posture tracking */}
            <div className="mt-4 pt-3 border-t border-border">
              <button
                onClick={() => isUsingCamera ? stopCamera() : startCamera()}
                disabled={isCameraLoading}
                className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors duration-150 flex items-center justify-center gap-2"
              >
                {isCameraLoading ? (
                  <span>Starting camera...</span>
                ) : isUsingCamera ? (
                  <>
                    <span className="w-2 h-2 rounded-full bg-flow-high animate-pulse" />
                    <span>Posture tracking active · Click to disable</span>
                  </>
                ) : (
                  <span>Enable camera for real posture tracking</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom: End Session Button */}
      <footer className="flex justify-center pt-8 animate-fade-in" style={{ animationDelay: '0.3s' }}>
        <button
          onClick={() => setIsEndDialogOpen(true)}
          className="px-8 py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border bg-card hover:bg-secondary hover:text-foreground transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
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
            <div className="fixed inset-0 bg-foreground/20 backdrop-blur-sm" />
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
                <Dialog.Panel className="w-full max-w-sm transform overflow-hidden rounded-2xl bg-card p-6 shadow-xl border border-border transition-all">
                  <Dialog.Title as="h3" className="text-lg font-semibold text-foreground mb-2">
                    End this session?
                  </Dialog.Title>
                  <Dialog.Description className="text-sm text-muted-foreground mb-6">
                    You've been studying for {formatTime(seconds)}. Ready to reflect on your progress?
                  </Dialog.Description>

                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsEndDialogOpen(false)}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-medium text-foreground bg-secondary hover:bg-muted transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                      Continue
                    </button>
                    <button
                      onClick={handleEndSession}
                      className="flex-1 px-4 py-3 rounded-xl text-sm font-semibold text-primary-foreground bg-primary hover:bg-primary/90 shadow-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
