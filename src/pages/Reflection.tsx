import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
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
          <p className="text-muted-foreground">
            You studied for {formatDuration(sessionDuration)}
          </p>
        </header>

        {/* Summary Card */}
        {/* TODO: Replace with actual AI-generated insights based on session data */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-8 shadow-soft">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Session Insight
          </h2>
          <p className="text-foreground leading-relaxed">
            You stayed focused best when your posture was upright. Consider maintaining that awareness in future sessions.
          </p>
        </section>

        {/* Reflection Prompt */}
        <section className="bg-accent/50 border border-border rounded-2xl p-6 mb-10">
          <p className="text-sm text-muted-foreground text-center leading-relaxed">
            Would you like to try a short movement break before your next session?
          </p>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <Button
            variant="flow"
            size="lg"
            className="w-full"
            onClick={handleStartAnother}
          >
            Start Another Session
          </Button>
          <Button
            variant="ghost"
            size="lg"
            className="w-full text-muted-foreground"
            onClick={handleExit}
          >
            Exit
          </Button>
        </div>
      </div>
    </main>
  );
};

export default Reflection;
