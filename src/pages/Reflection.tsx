import { useEffect, useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, ArrowRight, X, Loader2 } from 'lucide-react';
import { useSession } from '@/context/SessionContext';
import { supabase } from '@/integrations/supabase/client';

const Reflection = () => {
  const navigate = useNavigate();
  const { sessionDuration, studyGoal, energyLevel, averageFocusScore, resetSession } = useSession();
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);

  // Redirect if no session data
  useEffect(() => {
    if (!studyGoal || sessionDuration === 0) {
      navigate('/');
    }
  }, [studyGoal, sessionDuration, navigate]);

  // Fetch AI insight from Groq
  useEffect(() => {
    const fetchInsight = async () => {
      if (!studyGoal || sessionDuration === 0) return;
      
      setIsLoadingInsight(true);
      try {
        const { data, error } = await supabase.functions.invoke('reflection-insights', {
          body: {
            averageFocusScore,
            sessionDuration,
            studyGoal,
            energyLevel,
          },
        });

        if (error) {
          console.error('Error fetching insight:', error);
          setAiInsight("Great job completing your session! Keep building momentum.");
        } else {
          setAiInsight(data.insight || data.error || "Great session! Keep up the focused work.");
        }
      } catch (err) {
        console.error('Failed to fetch insight:', err);
        setAiInsight("Great job completing your session! Every focused minute counts.");
      } finally {
        setIsLoadingInsight(false);
      }
    };

    fetchInsight();
  }, [studyGoal, sessionDuration, averageFocusScore, energyLevel]);

  const formatDuration = useCallback((totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins === 0) {
      return `${secs} seconds`;
    }
    return `${mins} minute${mins !== 1 ? 's' : ''} and ${secs} second${secs !== 1 ? 's' : ''}`;
  }, []);

  // Display score (0-10) with harsher curve
  const displayFocusScore = Math.round(Math.pow(averageFocusScore, 1.3) * 10);
  
  // Get focus level label
  const getFocusLabel = (score: number) => {
    if (score >= 8) return { label: 'Excellent', color: 'text-flow-high' };
    if (score >= 6) return { label: 'Good', color: 'text-flow-medium' };
    if (score >= 4) return { label: 'Moderate', color: 'text-amber-500' };
    return { label: 'Needs Work', color: 'text-destructive' };
  };
  
  const focusInfo = getFocusLabel(displayFocusScore);

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

        {/* Average Focus Score Card */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-medium">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-4">
            Average Focus
          </h2>
          <div className="flex items-center justify-center gap-4">
            <div className={`text-6xl font-bold ${focusInfo.color}`}>
              {displayFocusScore}
            </div>
            <div className="text-left">
              <div className="text-2xl text-muted-foreground">/10</div>
              <div className={`text-sm font-medium ${focusInfo.color}`}>
                {focusInfo.label}
              </div>
            </div>
          </div>
          <div className="mt-4 w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full rounded-full transition-all duration-500 ${
                displayFocusScore >= 6 ? 'bg-flow-high' : displayFocusScore >= 4 ? 'bg-flow-medium' : 'bg-destructive'
              }`}
              style={{ width: `${displayFocusScore * 10}%` }}
            />
          </div>
        </section>

        {/* AI Insight Card */}
        <section className="bg-card border border-border rounded-2xl p-6 mb-4 shadow-medium">
          <h2 className="text-xs font-semibold text-primary uppercase tracking-wider mb-3">
            AI Insight
          </h2>
          {isLoadingInsight ? (
            <div className="flex items-center justify-center gap-2 py-4">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Analyzing your session...</span>
            </div>
          ) : (
            <p className="text-foreground text-[15px] leading-relaxed">
              {aiInsight}
            </p>
          )}
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
