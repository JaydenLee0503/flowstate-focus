import { useState, forwardRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioGroup, Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown, Sparkles, Clock } from 'lucide-react';
import { useSession, StudyGoal, EnergyLevel } from '@/context/SessionContext';
import { AIChatbot } from '@/components/AIChatbot';

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

const durationOptions: { value: number; label: string }[] = [
  { value: 15, label: '15 min' },
  { value: 25, label: '25 min' },
  { value: 45, label: '45 min' },
  { value: 60, label: '1 hour' },
  { value: 90, label: '1.5 hours' },
  { value: 120, label: '2 hours' },
];

const Index = forwardRef<HTMLElement>((_, ref) => {
  const navigate = useNavigate();
  const { setStudyGoal, setEnergyLevel, setPlannedDuration } = useSession();
  const [selectedGoal, setSelectedGoal] = useState<StudyGoal>(null);
  const [selectedEnergy, setSelectedEnergy] = useState<EnergyLevel>(null);
  const [selectedDuration, setSelectedDuration] = useState(25);

  const canStart = selectedGoal && selectedEnergy;

  const handleStart = () => {
    if (canStart) {
      setStudyGoal(selectedGoal);
      setEnergyLevel(selectedEnergy);
      setPlannedDuration(selectedDuration);
      navigate('/session');
    }
  };

  const selectedGoalData = studyGoals.find(g => g.value === selectedGoal);

  return (
    <main ref={ref} className="min-h-screen bg-gradient-to-b from-background via-background to-accent/20 flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md stagger-children">
        {/* Header */}
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent rounded-full mb-6">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-accent-foreground">AI-Powered Focus</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground mb-4">
            FLOWSTATE
          </h1>
          <p className="text-muted-foreground text-balance leading-relaxed text-base max-w-sm mx-auto">
            An intelligent focus companion that adapts to how you're feeling while studying.
          </p>
        </header>

        {/* Form Card */}
        <div className="bg-card rounded-2xl p-6 shadow-lg border border-border/50">
          {/* Study Goal Selection - Listbox */}
          <section className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2.5">
              What are you working on?
            </label>
            <Listbox value={selectedGoal} onChange={setSelectedGoal}>
              <div className="relative">
                <Listbox.Button className="relative w-full cursor-pointer rounded-xl bg-background py-3.5 pl-4 pr-10 text-left border border-border shadow-soft transition-all duration-200 hover:border-primary/50 hover:shadow-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card">
                  <span className={`block truncate text-[15px] ${selectedGoalData ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                    {selectedGoalData?.label || 'Select a study goal...'}
                  </span>
                  <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5">
                    <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  </span>
                </Listbox.Button>
                <Transition
                  enter="transition duration-150 ease-out"
                  enterFrom="transform scale-95 opacity-0 -translate-y-1"
                  enterTo="transform scale-100 opacity-100 translate-y-0"
                  leave="transition duration-100 ease-out"
                  leaveFrom="transform scale-100 opacity-100 translate-y-0"
                  leaveTo="transform scale-95 opacity-0 -translate-y-1"
                >
                  <Listbox.Options className="absolute z-20 mt-2 max-h-60 w-full overflow-auto rounded-xl bg-card py-2 shadow-lg border border-border focus:outline-none">
                    {studyGoals.map((goal) => (
                      <Listbox.Option
                        key={goal.value}
                        value={goal.value}
                        className={({ active, selected }) =>
                          `relative cursor-pointer select-none py-3 pl-11 pr-4 transition-colors ${
                            active ? 'bg-accent' : ''
                          } ${selected ? 'bg-accent/60' : ''}`
                        }
                      >
                        {({ selected }) => (
                          <>
                            <div>
                              <span className={`block text-[15px] ${selected ? 'font-semibold text-foreground' : 'text-foreground'}`}>
                                {goal.label}
                              </span>
                              <span className="block text-xs text-muted-foreground mt-0.5">
                                {goal.description}
                              </span>
                            </div>
                            {selected && (
                              <span className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-primary">
                                <Check className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                              </span>
                            )}
                          </>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            </Listbox>
          </section>

          {/* Energy Level Selection - RadioGroup */}
          <section className="mb-6">
            <label className="block text-sm font-medium text-foreground mb-2.5">
              Current energy level
            </label>
            <RadioGroup value={selectedEnergy} onChange={setSelectedEnergy} className="grid grid-cols-3 gap-3">
              {energyLevels.map((level) => (
                <RadioGroup.Option
                  key={level.value}
                  value={level.value}
                  className={({ checked, active }) =>
                    `cursor-pointer rounded-xl py-3 px-4 text-center font-medium transition-all duration-200 border-2 ${
                      checked
                        ? 'border-primary bg-primary/5 text-primary shadow-soft'
                        : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                    } ${active ? 'ring-2 ring-ring ring-offset-2 ring-offset-card' : ''}`
                  }
                >
                  {level.label}
                </RadioGroup.Option>
              ))}
            </RadioGroup>
          </section>

          {/* Duration Selection */}
          <section className="mb-8">
            <label className="block text-sm font-medium text-foreground mb-2.5">
              <Clock className="w-4 h-4 inline-block mr-1.5 -mt-0.5" />
              How long do you want to study?
            </label>
            <div className="grid grid-cols-3 gap-2">
              {durationOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSelectedDuration(option.value)}
                  className={`py-2.5 px-3 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${
                    selectedDuration === option.value
                      ? 'border-primary bg-primary/5 text-primary shadow-soft'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/30 hover:text-foreground'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </section>

          {/* Start Button */}
          <button
            disabled={!canStart}
            onClick={handleStart}
            className={`w-full py-4 px-8 rounded-xl text-base font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-card ${
              canStart
                ? 'bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:bg-primary/90 active:scale-[0.98]'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            }`}
          >
            Start Study Session
          </button>
        </div>

        {/* Footer hint */}
        <p className="text-center text-xs text-muted-foreground mt-6">
          No account needed. Your session stays private.
        </p>
      </div>

      {/* Floating AI Chatbot */}
      <AIChatbot />
    </main>
  );
});

Index.displayName = 'Index';

export default Index;
