import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadioGroup, Listbox, Transition } from '@headlessui/react';
import { Check, ChevronDown } from 'lucide-react';
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

  const selectedGoalData = studyGoals.find(g => g.value === selectedGoal);

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-md stagger-children">
        {/* Header */}
        <header className="text-center mb-14">
          <h1 className="text-3xl font-semibold tracking-tight text-foreground mb-3">
            FLOWSTATE
          </h1>
          <p className="text-muted-foreground text-balance leading-relaxed text-[15px]">
            An AI-powered focus companion that adapts to how you're feeling while studying.
          </p>
        </header>

        {/* Study Goal Selection - Listbox */}
        <section className="mb-8">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            What are you working on?
          </label>
          <Listbox value={selectedGoal} onChange={setSelectedGoal}>
            <div className="relative">
              <Listbox.Button className="relative w-full cursor-pointer rounded-lg bg-card py-3.5 pl-4 pr-10 text-left border border-border shadow-soft transition-all duration-150 hover:border-primary/40 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background">
                <span className={`block truncate ${selectedGoalData ? 'text-foreground' : 'text-muted-foreground'}`}>
                  {selectedGoalData?.label || 'Select a study goal...'}
                </span>
                <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                </span>
              </Listbox.Button>
              <Transition
                enter="transition duration-100 ease-out"
                enterFrom="transform scale-95 opacity-0"
                enterTo="transform scale-100 opacity-100"
                leave="transition duration-75 ease-out"
                leaveFrom="transform scale-100 opacity-100"
                leaveTo="transform scale-95 opacity-0"
              >
                <Listbox.Options className="absolute z-10 mt-2 max-h-60 w-full overflow-auto rounded-lg bg-card py-1.5 shadow-lg ring-1 ring-border focus:outline-none">
                  {studyGoals.map((goal) => (
                    <Listbox.Option
                      key={goal.value}
                      value={goal.value}
                      className={({ active, selected }) =>
                        `relative cursor-pointer select-none py-3 pl-10 pr-4 transition-colors ${
                          active ? 'bg-accent' : ''
                        } ${selected ? 'bg-accent/50' : ''}`
                      }
                    >
                      {({ selected }) => (
                        <>
                          <div>
                            <span className={`block truncate ${selected ? 'font-medium text-foreground' : 'text-foreground'}`}>
                              {goal.label}
                            </span>
                            <span className="block text-xs text-muted-foreground mt-0.5">
                              {goal.description}
                            </span>
                          </div>
                          {selected && (
                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-primary">
                              <Check className="h-4 w-4" aria-hidden="true" />
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
        <section className="mb-12">
          <label className="block text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
            Current energy level
          </label>
          <RadioGroup value={selectedEnergy} onChange={setSelectedEnergy} className="flex gap-3">
            {energyLevels.map((level) => (
              <RadioGroup.Option
                key={level.value}
                value={level.value}
                className={({ checked, active }) =>
                  `flex-1 cursor-pointer rounded-lg py-3 px-4 text-center font-medium transition-all duration-150 border ${
                    checked
                      ? 'border-primary bg-accent text-foreground shadow-soft'
                      : 'border-border bg-card text-muted-foreground hover:border-primary/30 hover:bg-accent/30'
                  } ${active ? 'ring-2 ring-ring ring-offset-2 ring-offset-background' : ''}`
                }
              >
                {level.label}
              </RadioGroup.Option>
            ))}
          </RadioGroup>
        </section>

        {/* Start Button */}
        <button
          disabled={!canStart}
          onClick={handleStart}
          className={`w-full py-4 px-8 rounded-lg text-base font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 focus:ring-offset-background ${
            canStart
              ? 'bg-primary text-primary-foreground shadow-medium hover:bg-primary/90 active:scale-[0.98]'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          }`}
        >
          Start Study Session
        </button>
      </div>
    </main>
  );
};

export default Index;
