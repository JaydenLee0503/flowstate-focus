import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, X } from 'lucide-react';
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
    <main className="min-h-screen bg-gradient-to-b from-background to-accent/20 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md stagger-children">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 rounded-full bg-accent flex items-center justify-center">
            <CheckCircle2 className="w-8 h-8 text-primary" strokeWidth={1.5} />
          </div>
        </div>

        {/* Header */}
        <header className="text-center mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground mb-2">
            Great Session!
          </h1>
          <p className="text-muted-foreground text-base">
            You studied for <span className="font-semibold text-foreground">{formatDuration(sessionDuration)}</span>
          </p>
        </header>

        {/* Summary Card */}
        {/* TODO: Replace with actual AI-generated insights based on session data */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-medium">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
            Session Insight
          </h2>
          <p className="text-foreground text-[15px] leading-relaxed">
            You stayed focused best when your posture was upright. Consider maintaining that awareness in future sessions.
          </p>
        </section>

        {/* Reflection Prompt */}
        <section className="bg-accent/50 border border-primary/10 rounded-2xl p-5 mb-8">
          <p className="text-sm text-accent-foreground text-center leading-relaxed">
            💡 Would you like to try a short movement break before your next session?
          </p>
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={handleStartAnother}
            className="w-full py-4 px-6 rounded-xl text-base font-semibold text-primary-foreground bg-primary shadow-lg hover:shadow-xl hover:bg-primary/90 active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center gap-2"
          >
            Start Another Session
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleExit}
            className="w-full py-3 px-6 rounded-xl text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background flex items-center justify-center gap-2"
          >
            <X className="w-4 h-4" />
            Exit
          </button>
        </div>
      </div>
    </main>
  );
};

export default Reflection;
