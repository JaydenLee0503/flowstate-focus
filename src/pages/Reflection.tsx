import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '@/context/SessionContext';

const Reflection = () => {
  const navigate = useNavigate();
  const { sessionDuration, studyGoal, resetSession } = useSession();

  // Redirect if no session data
  useEffect(() => {
    if (!studyGoal || sessionDuration === 0) {
      navigate('/');
    }
  }, [studyGoal, sessionDuration, navigate]);

  const formatDuration = useCallback((totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) {
      return `${secs} seconds`;
    }
    return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
  }, []);

  const handleStartAnother = () => {
    resetSession();
    navigate('/');
  };

  const handleExit = () => {
    resetSession();
    navigate('/');
  };

  if (!studyGoal) return null;

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md stagger-children">
        {/* Header */}
        <header className="text-center mb-10">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground mb-2">
            Session Reflection
          </h1>
          <p className="text-muted-foreground text-[15px]">
            You studied for {formatDuration(sessionDuration)}
          </p>
        </header>

        {/* Summary Card */}
        {/* TODO: Replace with actual AI-generated insights based on session data */}
        <section className="bg-card border border-border rounded-xl p-5 mb-6 shadow-soft">
          <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2.5">
            Session Insight
          </h2>
          <p className="text-foreground text-[15px] leading-relaxed">
            You stayed focused best when your posture was upright. Consider maintaining that awareness in future sessions.
          </p>
        </section>

        {/* Reflection Prompt */}
        <section className="bg-accent/60 border border-border rounded-xl p-5 mb-10">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Would you like to try a short movement break before your next session?
          </p>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStartAnother}
            className="w-full py-3.5 px-6 rounded-lg text-base font-medium text-primary-foreground bg-primary shadow-medium hover:bg-primary/90 active:scale-[0.98] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            Start Another Session
          </button>
          <button
            onClick={handleExit}
            className="w-full py-3 px-6 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background"
          >
            Exit
          </button>
        </div>
      </div>
    </main>
  );
};

export default Reflection;
