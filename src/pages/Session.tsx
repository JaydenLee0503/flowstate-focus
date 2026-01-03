import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, Transition } from '@headlessui/react';
import { Fragment } from 'react';
import { useSession } from '@/context/SessionContext';
import { usePostureDetection } from '@/hooks/usePostureDetection';
import { useYoloDetection } from '@/hooks/useYoloDetection';
import { useNudgeGenerator } from '@/hooks/useNudgeGenerator';
import { AIChatbot } from '@/components/AIChatbot';

const goalLabels: Record<string, string> = {
  reading: 'Reading / Review',
  'problem-solving': 'Problem Solving',
  memorization: 'Memorization',
};

const Session = () => {
  const navigate = useNavigate();
  const { studyGoal, energyLevel, plannedDuration, setSessionDuration } = useSession();
  const [secondsRemaining, setSecondsRemaining] = useState(plannedDuration * 60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [flowLevel, setFlowLevel] = useState<'building' | 'flowing' | 'deep'>('building');
  const [isEndDialogOpen, setIsEndDialogOpen] = useState(false);
  const [cameraAutoStarted, setCameraAutoStarted] = useState(false);
  const [sessionComplete, setSessionComplete] = useState(false);
  
  // Detection mode: 'posture' focuses on user, 'environment' focuses on desk
  const [detectionMode, setDetectionMode] = useState<'posture' | 'environment'>('posture');
  
  // MediaPipe-powered posture detection (local, no API calls)
  const { 
    postureScore: mediaPipeScore, 
    isDistracted: mediaPipeDistracted,
    isUsingCamera, 
    isLoading: isCameraLoading,
    faceDetected,
    poseDetected,
    metrics,
    videoRef,
    canvasRef,
    startCamera, 
    stopCamera 
  } = usePostureDetection();

  // YOLO-powered object detection (phones, distracting items)
  const {
    phoneDetected,
    deskCluttered,
    distractingItems,
    allDetections,
    isModelLoading: isYoloLoading,
    isModelLoaded: isYoloLoaded,
  } = useYoloDetection(videoRef, isUsingCamera);

  // Auto-start camera when session loads
  useEffect(() => {
    if (!cameraAutoStarted && studyGoal && energyLevel) {
      setCameraAutoStarted(true);
      // Small delay to ensure component is mounted
      const timer = setTimeout(() => {
        startCamera();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [cameraAutoStarted, studyGoal, energyLevel, startCamera]);

  // ---- COMBINED DISTRACTION LOGIC ----
  // In posture mode: focus on head position
  // In environment mode: focus on phone/clutter detection
  const isDistracted = detectionMode === 'posture' 
    ? mediaPipeDistracted || phoneDetected
    : phoneDetected || deskCluttered || distractingItems.length > 2;
  
  // Combined posture score based on mode
  let postureScore = mediaPipeScore;
  if (detectionMode === 'environment') {
    // Environment mode: score based on desk cleanliness
    if (phoneDetected) postureScore = Math.min(postureScore, 0.3);
    if (deskCluttered) postureScore = Math.min(postureScore, 0.4);
    if (distractingItems.length > 0) {
      postureScore = Math.max(0.2, postureScore - distractingItems.length * 0.15);
    }
  } else {
    // Posture mode: phone still matters
    if (phoneDetected) postureScore = Math.min(postureScore, 0.4);
  }

  // LLM-powered nudge generation via Groq (triggers on distraction state change)
  const { nudge: aiSuggestion, isLoading: isNudgeLoading } = useNudgeGenerator({
    isDistracted,
    studyGoal,
    energyLevel
  });

  // Convert 0-1 score to 1-10 display score
  const displayScore = Math.round(postureScore * 10);

  // Ref for video container to attach the canvas element (shows landmarks)
  const videoContainerRef = useRef<HTMLDivElement>(null);

  // Attach canvas (with landmarks) to container when camera is active
  useEffect(() => {
    const container = videoContainerRef.current;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (isUsingCamera && container) {
      container.innerHTML = '';
      
      // Use canvas if available (shows pose landmarks), otherwise use video
      const displayElement = canvas || video;
      if (displayElement) {
        displayElement.style.width = '100%';
        displayElement.style.height = '100%';
        displayElement.style.objectFit = 'cover';
        displayElement.style.borderRadius = '0.75rem';
        displayElement.style.transform = 'scaleX(-1)';
        container.appendChild(displayElement);
      }
    }
  }, [isUsingCamera, canvasRef, videoRef]);
  // Redirect if no session data
  useEffect(() => {
    if (!studyGoal || !energyLevel) {
      navigate('/');
    }
  }, [studyGoal, energyLevel, navigate]);

  // Check if unlimited mode (plannedDuration === 0)
  const isUnlimited = plannedDuration === 0;

  // Initialize timer with planned duration
  useEffect(() => {
    if (!isUnlimited) {
      setSecondsRemaining(plannedDuration * 60);
    }
  }, [plannedDuration, isUnlimited]);

  // Timer - counts down for timed sessions, counts up for unlimited
  useEffect(() => {
    if (sessionComplete) return;
    
    const interval = setInterval(() => {
      if (isUnlimited) {
        // Count up for unlimited mode
        setElapsedSeconds((s) => s + 1);
      } else {
        // Count down for timed mode
        setSecondsRemaining((s) => {
          if (s <= 1) {
            setSessionComplete(true);
            return 0;
          }
          return s - 1;
        });
        setElapsedSeconds((s) => s + 1);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionComplete, isUnlimited]);

  // Flow level based on elapsed time
  useEffect(() => {
    if (elapsedSeconds >= 300) {
      setFlowLevel('deep');
    } else if (elapsedSeconds >= 120) {
      setFlowLevel('flowing');
    } else {
      setFlowLevel('building');
    }
  }, [elapsedSeconds]);


  const formatTime = useCallback((totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const handleEndSession = () => {
    setSessionDuration(elapsedSeconds);
    navigate('/reflection');
  };

  // Calculate progress percentage
  const totalSeconds = plannedDuration * 60;
  const progressPercent = Math.min(100, ((totalSeconds - secondsRemaining) / totalSeconds) * 100);

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
          {/* Large Timer - Countdown or Count-up for unlimited */}
          <div className="mb-8">
            <span className={`text-8xl md:text-9xl font-extralight tracking-tight tabular-nums ${sessionComplete ? 'text-primary animate-pulse' : 'text-foreground'}`}>
              {isUnlimited ? formatTime(elapsedSeconds) : formatTime(secondsRemaining)}
            </span>
            {isUnlimited && (
              <p className="mt-2 text-sm text-muted-foreground">Unlimited session</p>
            )}
            {sessionComplete && !isUnlimited && (
              <p className="mt-4 text-lg font-medium text-primary">Session Complete!</p>
            )}
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

          {/* AI Nudge - LLM-generated supportive messages via Groq */}
          <div className="max-w-md mx-auto px-8 py-7 bg-card rounded-2xl border border-border shadow-medium">
            <p className={`text-base text-muted-foreground text-center leading-relaxed transition-opacity duration-300 ${isNudgeLoading ? 'opacity-50' : 'opacity-100'}`}>
              "{aiSuggestion}"
            </p>
            
            {/* Detection Alerts */}
            {isUsingCamera && (phoneDetected || deskCluttered || isDistracted) && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                {phoneDetected && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-destructive/10 text-destructive text-xs font-medium rounded-full">
                    <span className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
                    Phone detected
                  </span>
                )}
                {deskCluttered && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 text-amber-600 text-xs font-medium rounded-full">
                    <span className="w-2 h-2 rounded-full bg-amber-500" />
                    Desk needs tidying
                  </span>
                )}
                {isDistracted && !phoneDetected && !deskCluttered && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 text-blue-600 text-xs font-medium rounded-full">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    Posture check
                  </span>
                )}
              </div>
            )}
            
            {/* Distracting Items List */}
            {isUsingCamera && distractingItems && distractingItems.length > 0 && (
              <p className="mt-2 text-xs text-muted-foreground text-center">
                Spotted: {distractingItems.join(', ')}
              </p>
            )}
            
            {/* YOLO Loading Indicator */}
            {isUsingCamera && isYoloLoading && (
              <p className="mt-2 text-xs text-muted-foreground text-center animate-pulse">
                Loading object detection...
              </p>
            )}
            
            <div className="mt-4 flex items-center justify-center gap-3">
              <div className="text-sm text-muted-foreground">Focus:</div>
              <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 rounded-full ${postureScore > 0.6 ? 'bg-flow-high' : postureScore > 0.3 ? 'bg-flow-medium' : 'bg-destructive'}`}
                  style={{ width: `${postureScore * 100}%` }}
                />
              </div>
              <div className={`text-lg font-bold min-w-[2rem] text-center ${postureScore > 0.6 ? 'text-flow-high' : postureScore > 0.3 ? 'text-flow-medium' : 'text-destructive'}`}>
                {displayScore}
              </div>
            </div>
            
            {/* Detection Status */}
            {isUsingCamera && (
              <div className="mt-3 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className={`flex items-center gap-1 ${faceDetected ? 'text-flow-high' : 'text-muted-foreground/50'}`}>
                  <span className={`w-2 h-2 rounded-full ${faceDetected ? 'bg-flow-high' : 'bg-muted'}`} />
                  Face
                </span>
                <span className={`flex items-center gap-1 ${poseDetected ? 'text-flow-high' : 'text-muted-foreground/50'}`}>
                  <span className={`w-2 h-2 rounded-full ${poseDetected ? 'bg-flow-high' : 'bg-muted'}`} />
                  Pose
                </span>
                <span className={`flex items-center gap-1 ${isYoloLoaded ? 'text-flow-high' : 'text-muted-foreground/50'}`}>
                  <span className={`w-2 h-2 rounded-full ${isYoloLoaded ? 'bg-flow-high' : 'bg-muted'}`} />
                  Objects
                </span>
              </div>
            )}
            
            {/* Camera Preview & Controls */}
            <div className="mt-5 pt-4 border-t border-border">
              {isUsingCamera && (
                <>
                  {/* Mode Toggle */}
                  <div className="mb-4 flex justify-center gap-2">
                    <button
                      onClick={() => setDetectionMode('posture')}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                        detectionMode === 'posture'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      👤 Posture Mode
                    </button>
                    <button
                      onClick={() => setDetectionMode('environment')}
                      className={`px-4 py-2 text-xs font-medium rounded-lg transition-colors ${
                        detectionMode === 'environment'
                          ? 'bg-primary text-primary-foreground'
                          : 'bg-muted text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      🪑 Environment Mode
                    </button>
                  </div>
                  
                  {/* Video Preview */}
                  <div className="mb-4">
                    <div 
                      ref={videoContainerRef}
                      className="w-full aspect-video bg-muted rounded-xl overflow-hidden border border-border"
                    />
                  </div>
                </>
              )}
              
              <button
                onClick={() => isUsingCamera ? stopCamera() : startCamera()}
                disabled={isCameraLoading}
                className={`w-full text-sm transition-colors duration-150 flex items-center justify-center gap-2 py-3 rounded-lg ${
                  isUsingCamera 
                    ? 'text-destructive hover:bg-destructive/10' 
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isCameraLoading ? (
                  <span>Starting camera...</span>
                ) : isUsingCamera ? (
                  <>
                    <span className="w-2.5 h-2.5 rounded-full bg-destructive" />
                    <span>Disable Camera</span>
                  </>
                ) : (
                  <span>Enable camera for AI analysis</span>
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
                    You've been studying for {formatTime(elapsedSeconds)}. Ready to reflect on your progress?
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
