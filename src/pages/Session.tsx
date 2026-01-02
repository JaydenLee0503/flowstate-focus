import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useSession } from '@/context/SessionContext';
import { useVisionPostureDetection } from '@/hooks/useVisionPostureDetection';
import { useNudgeGenerator } from '@/hooks/useNudgeGenerator';
import { AIChatbot } from '@/components/AIChatbot';

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
  
  // AI Vision-powered attention/posture detection (Gemini)
  const { 
    postureScore, 
    isDistracted,
    phoneDetected,
    lookingDown,
    deskCluttered,
    distractingItems,
    analysis,
    isCameraOn: isUsingCamera, 
    isLoading: isCameraLoading,
    videoRef,
    startCamera, 
    stopCamera 
  } = useVisionPostureDetection();

  // LLM-powered nudge generation (triggers on distraction state change)
  const { nudge: aiSuggestion, isLoading: isNudgeLoading } = useNudgeGenerator({
    isDistracted,
    studyGoal,
    energyLevel
  });

  // Ref for video container to attach the video element
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Attach video element to container when camera is active
  useEffect(() => {
    const container = videoContainerRef.current;
    const video = videoRef.current;
    
    if (isUsingCamera && video && container) {
      // Clear container and append the hook's video element directly
      container.innerHTML = '';
      
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';
      video.style.borderRadius = '0.75rem';
      video.style.transform = 'scaleX(-1)'; // Mirror the video
      
      container.appendChild(video);
    }
  }, [isUsingCamera, videoRef]);
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
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/10 flex flex-col px-4 py-6 md:px-6 md:py-8">
      {/* Top Bar: Timer + Task Label + Flow */}
      <header className="flex items-center justify-between animate-fade-in mb-6">
        <div className="flex items-center gap-4">
          {/* Compact Timer */}
          <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-xl border border-border shadow-sm">
            <span className="text-2xl md:text-3xl font-light tracking-tight text-foreground tabular-nums">
              {formatTime(seconds)}
            </span>
          </div>
          
          {/* Flow Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-2 bg-card rounded-xl border border-border">
            <div
              className={`w-2.5 h-2.5 rounded-full ${flowConfig[flowLevel].color} animate-pulse-soft`}
              style={{ boxShadow: `0 0 8px 1px hsl(var(--flow-${flowLevel === 'deep' ? 'high' : flowLevel}))` }}
            />
            <span className="text-xs font-medium text-foreground">
              {flowConfig[flowLevel].label}
            </span>
          </div>
        </div>
        
        {/* Task Label */}
        <span className="text-xs font-semibold text-primary uppercase tracking-wider px-3 py-1.5 bg-accent rounded-full border border-primary/20">
          {goalLabels[studyGoal]}
        </span>
      </header>

      {/* Main Content: Camera Focus View */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6">
        
        {/* Camera Section - Main Focus */}
        <div className="flex-1 flex flex-col">
          <div className="relative flex-1 bg-card rounded-2xl border border-border shadow-medium overflow-hidden min-h-[300px] md:min-h-[400px]">
            {isUsingCamera ? (
              <>
                {/* Large Camera View */}
                <div 
                  ref={videoContainerRef}
                  className="absolute inset-0 bg-muted"
                />
                
                {/* Overlay: Posture Score */}
                <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border">
                  <div className="text-xs text-muted-foreground">Posture</div>
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500 rounded-full ${postureScore > 0.6 ? 'bg-flow-high' : postureScore > 0.3 ? 'bg-flow-medium' : 'bg-destructive'}`}
                      style={{ width: `${postureScore * 100}%` }}
                    />
                  </div>
                  <span className={`text-xs font-semibold ${postureScore > 0.6 ? 'text-flow-high' : postureScore > 0.3 ? 'text-flow-medium' : 'text-destructive'}`}>
                    {Math.round(postureScore * 100)}%
                  </span>
                </div>
                
                {/* Overlay: Detection Alerts */}
                {(phoneDetected || deskCluttered) && (
                  <div className="absolute top-4 right-4 flex flex-col gap-2">
                    {phoneDetected && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/90 text-destructive-foreground text-xs font-medium rounded-lg shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                        Phone detected
                      </span>
                    )}
                    {deskCluttered && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/90 text-white text-xs font-medium rounded-lg shadow-lg">
                        <span className="w-2 h-2 rounded-full bg-white" />
                        Desk cluttered
                      </span>
                    )}
                  </div>
                )}
                
                {/* Overlay: AI Analysis */}
                {analysis && (
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="px-4 py-3 bg-background/90 backdrop-blur-sm rounded-xl border border-border">
                      <p className="text-sm text-foreground font-medium text-center">
                        {analysis}
                      </p>
                      {distractingItems && distractingItems.length > 0 && (
                        <p className="mt-1 text-xs text-muted-foreground text-center">
                          Detected: {distractingItems.join(', ')}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                
                {/* Disable Camera Button */}
                <button
                  onClick={stopCamera}
                  className="absolute top-4 right-4 p-2 bg-background/80 backdrop-blur-sm rounded-lg border border-border hover:bg-destructive/10 hover:text-destructive transition-colors"
                  style={{ display: phoneDetected || deskCluttered ? 'none' : 'block' }}
                >
                  <span className="sr-only">Disable camera</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </>
            ) : (
              /* Camera Off State */
              <div className="absolute inset-0 flex flex-col items-center justify-center p-8">
                <div className="w-20 h-20 mb-6 rounded-full bg-muted flex items-center justify-center">
                  <svg className="w-10 h-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Enable Camera</h3>
                <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
                  Get real-time posture feedback, phone detection, and desk analysis powered by AI vision.
                </p>
                <button
                  onClick={startCamera}
                  disabled={isCameraLoading}
                  className="px-6 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {isCameraLoading ? 'Starting...' : 'Start Camera'}
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Side Panel: AI Suggestions & Stats */}
        <div className="lg:w-80 flex flex-col gap-4">
          {/* AI Nudge Card */}
          <div className="px-6 py-5 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-primary" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">AI Coach</span>
            </div>
            <p className={`text-sm text-foreground leading-relaxed transition-opacity duration-300 ${isNudgeLoading ? 'opacity-50' : 'opacity-100'}`}>
              {aiSuggestion}
            </p>
          </div>
          
          {/* Flow Progress */}
          <div className="px-6 py-5 bg-card rounded-2xl border border-border shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Flow State</span>
              <span className="text-xs font-semibold text-foreground">{flowConfig[flowLevel].label}</span>
            </div>
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${flowConfig[flowLevel].barColor} transition-all duration-1000 ease-out rounded-full`}
                style={{ width: flowConfig[flowLevel].width }}
              />
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              {flowLevel === 'building' && 'Keep going! Deep focus takes time to build.'}
              {flowLevel === 'flowing' && 'Great momentum! You\'re in the zone.'}
              {flowLevel === 'deep' && 'Excellent! You\'ve reached deep focus.'}
            </p>
          </div>
          
          {/* Session Stats */}
          <div className="px-6 py-5 bg-card rounded-2xl border border-border shadow-sm">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Session</span>
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <div className="text-2xl font-light text-foreground tabular-nums">{formatTime(seconds)}</div>
                <div className="text-xs text-muted-foreground">Duration</div>
              </div>
              <div>
                <div className="text-2xl font-light text-foreground">{Math.round(postureScore * 100)}%</div>
                <div className="text-xs text-muted-foreground">Avg Posture</div>
              </div>
            </div>
          </div>
          
          {/* End Session Button */}
          <button
            onClick={() => setIsEndDialogOpen(true)}
            className="mt-auto px-6 py-3 rounded-xl text-sm font-medium text-muted-foreground border border-border bg-card hover:bg-secondary hover:text-foreground transition-all duration-200"
          >
            End Session
          </button>
        </div>
      </div>
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

      {/* Floating AI Chatbot */}
      <AIChatbot />
    </main>
  );
};

export default Session;
