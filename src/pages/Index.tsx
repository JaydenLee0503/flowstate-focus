import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useSession, StudyGoal, EnergyLevel } from '@/context/SessionContext';

const studyGoals: { value: StudyGoal; label: string; description: string }[] = [
  { value: 'reading', label: 'Reading / Review', description: 'Absorbing and reviewing material' },
  { value: 'problem-solving', label: 'Problem Solving', description: 'Working through exercises' },
  { value: 'memorization', label: 'Memorization', description: 'Committing facts to memory' },
];

const energyLevels: { value: EnergyLevel; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];

const Index = () => {
  const navigate = useNavigate();
  const { setStudyGoal, setEnergyLevel } = useSession();
  const [selectedGoal, setSelectedGoal] = useState<StudyGoal>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel>(null);

  const canStart = selectedGoal && selectedEnergy;

  const handleStart = () => {
    if (canStart) {
      setStudyGoal(selectedGoal);
      setEnergyLevel(selectedEnergy);
      navigate('/session');
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md stagger-children">
        {/* Header */}
        <header className="text-center mb-12">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
            FLOWSTATE
          </h1>
          <p className="text-muted-foreground text-balance leading-relaxed">
            An AI-powered focus companion that adapts to how you're feeling while studying.
          </p>
        </header>

        {/* Study Goal Selection */}
        <section className="mb-10">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
            What are you working on?
          </h2>
          <div className="space-y-3">
            {studyGoals.map((goal) => (
              <button
                key={goal.value}
                onClick={() => setSelectedGoal(goal.value)}
                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 ${
                  selectedGoal === goal.value
                    ? 'border-primary bg-accent shadow-soft'
                    : 'border-border bg-card hover:border-primary/30 hover:bg-accent/50'
                }`}
              >
                <span className="block font-medium text-foreground">
                  {goal.label}
                </span>
                <span className="block text-sm text-muted-foreground mt-0.5">
                  {goal.description}
                </span>
              </button>
            ))}
          </div>
        </section>

        {/* Energy Level Selection */}
        <section className="mb-12">
          <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-4">
            Current energy level
          </h2>
          <div className="flex gap-3">
            {energyLevels.map((level) => (
              <button
                key={level.value}
                onClick={() => setSelectedEnergy(level.value)}
                className={`flex-1 py-3 px-4 rounded-xl border text-center font-medium transition-all duration-200 ${
                  selectedEnergy === level.value
                    ? 'border-primary bg-accent text-foreground shadow-soft'
                    : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/50'
                }`}
              >
                {level.label}
              </button>
            ))}
          </div>
        </section>

        {/* Start Button */}
        <Button
          variant="flow"
          size="xl"
          className="w-full"
          disabled={!canStart}
          onClick={handleStart}
        >
          Start Study Session
        </Button>
      </div>
    </main>
  );
};

export default Index;
