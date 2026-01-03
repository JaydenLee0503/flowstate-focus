import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * FLOWSTATE Smart Nudge Generator
 * 
 * Generates context-aware, personalized nudges based on:
 * - Study mode (problem solving, reading, writing, etc.)
 * - Energy level (low, medium, high)
 * - Current attention/posture state
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Mode-specific guidance for the AI
const MODE_CONTEXTS = {
  'problem-solving': {
    focused: "They're in deep analytical thinking mode, working through complex problems.",
    distracted: "They may be stuck on a problem or need a mental reset.",
    tips: "Encourage taking a step back, breaking problems into smaller pieces, or trying a different approach."
  },
  'reading': {
    focused: "They're absorbing information and maintaining reading flow.",
    distracted: "Their reading attention has drifted.",
    tips: "Suggest active reading techniques like summarizing or taking short notes."
  },
  'writing': {
    focused: "They're in a creative flow, producing content.",
    distracted: "Their writing momentum has slowed.",
    tips: "Encourage free-writing or suggest a brief outline refresh."
  },
  'memorizing': {
    focused: "They're actively encoding information into memory.",
    distracted: "Memory encoding has been interrupted.",
    tips: "Suggest spaced repetition or creating mental associations."
  },
  'general': {
    focused: "They're maintaining good study focus.",
    distracted: "Their attention has wandered.",
    tips: "Gentle encouragement to refocus."
  }
};

// Energy-specific tone adjustments
const ENERGY_TONES = {
  'low': {
    style: "Extra gentle and understanding. Acknowledge that energy is limited.",
    suggestions: "Short breaks, hydration, light stretching, or switching to easier tasks.",
    avoid: "Avoid anything that sounds demanding or adds pressure."
  },
  'medium': {
    style: "Balanced and supportive. Maintain steady encouragement.",
    suggestions: "Pomodoro technique, mixing task types, or brief mindfulness.",
    avoid: "Avoid being too pushy or too passive."
  },
  'high': {
    style: "Energetic and motivating. Match their high energy.",
    suggestions: "Tackling challenging tasks, deep work sessions, or ambitious goals.",
    avoid: "Avoid being too calm or slow-paced."
  }
};

// Fallback messages organized by mode and state
const FALLBACKS = {
  'problem-solving': {
    low: {
      distracted: "Complex problems are tough when tired—maybe sketch out the problem visually?",
      focused: "Steady problem-solving, even with low energy, is impressive."
    },
    medium: {
      distracted: "Stuck? Try explaining the problem out loud—it often helps.",
      focused: "Nice analytical flow—keep building on those insights."
    },
    high: {
      distracted: "Channel that energy into breaking this problem into smaller pieces.",
      focused: "You're in the zone—great time to tackle the trickiest parts."
    }
  },
  'reading': {
    low: {
      distracted: "Reading when tired is hard—try summarizing the last paragraph you read.",
      focused: "Good reading pace, even with limited energy."
    },
    medium: {
      distracted: "Try reading the next section out loud to re-engage.",
      focused: "Solid reading focus—the material is sinking in."
    },
    high: {
      distracted: "Your energy is high—try active note-taking to stay engaged.",
      focused: "Great reading flow—perfect time to tackle denser material."
    }
  },
  'general': {
    low: {
      distracted: "Energy is low—a short break or some water might help.",
      focused: "Nice focus despite the low energy—be proud of that."
    },
    medium: {
      distracted: "A quick posture reset might help you refocus.",
      focused: "Good steady focus—you're in a nice rhythm."
    },
    high: {
      distracted: "Lots of energy to channel—try diving into something engaging.",
      focused: "Excellent focus—you're making great use of this energy."
    }
  }
};

function getFallback(studyGoal: string, energyLevel: string, isDistracted: boolean): string {
  const mode = FALLBACKS[studyGoal as keyof typeof FALLBACKS] || FALLBACKS['general'];
  const energy = mode[energyLevel as keyof typeof mode] || mode['medium'];
  return isDistracted ? energy.distracted : energy.focused;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { isDistracted, studyGoal, energyLevel } = await req.json();
    
    const normalizedGoal = (studyGoal || 'general').toLowerCase().replace(/\s+/g, '-');
    const normalizedEnergy = (energyLevel || 'medium').toLowerCase();
    
    const GROQ_API_KEY = Deno.env.get('GROQ_API_KEY');
    if (!GROQ_API_KEY) {
      console.log("GROQ_API_KEY not configured, using smart fallback");
      return new Response(
        JSON.stringify({ nudge: getFallback(normalizedGoal, normalizedEnergy, isDistracted) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get mode-specific context
    const modeContext = MODE_CONTEXTS[normalizedGoal as keyof typeof MODE_CONTEXTS] || MODE_CONTEXTS['general'];
    const energyTone = ENERGY_TONES[normalizedEnergy as keyof typeof ENERGY_TONES] || ENERGY_TONES['medium'];

    const systemPrompt = `You are a calm, supportive study companion for FLOWSTATE.
Generate ONE short sentence (max 25 words) that gently encourages the user.

STUDY MODE: ${studyGoal || 'general study'}
${isDistracted ? modeContext.distracted : modeContext.focused}
Mode-specific tip: ${modeContext.tips}

ENERGY LEVEL: ${energyLevel || 'medium'}
Tone: ${energyTone.style}
Consider suggesting: ${energyTone.suggestions}
${energyTone.avoid}

CURRENT STATE: ${isDistracted ? 'attention/posture has dipped' : 'good focus and posture'}

CRITICAL RULES:
- Be non-judgmental and warm
- Never shame productivity
- No medical/mental health language
- No commands like "you must" or "stop"
- Match the energy level in your tone
- Reference the specific study mode naturally

Respond with ONLY the nudge sentence.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: isDistracted 
            ? `Generate a ${normalizedEnergy}-energy nudge for someone doing ${studyGoal} who needs to refocus` 
            : `Generate a ${normalizedEnergy}-energy encouragement for someone doing ${studyGoal} well` 
          }
        ],
        temperature: 0.8,
        max_tokens: 60,
      }),
    });

    if (!response.ok) {
      console.log(`API error ${response.status}, using smart fallback`);
      return new Response(
        JSON.stringify({ nudge: getFallback(normalizedGoal, normalizedEnergy, isDistracted) }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const nudge = data.choices?.[0]?.message?.content?.trim() || 
      getFallback(normalizedGoal, normalizedEnergy, isDistracted);

    console.log(`Generated nudge [${studyGoal}/${energyLevel}/${isDistracted ? 'distracted' : 'focused'}]:`, nudge);

    return new Response(
      JSON.stringify({ nudge }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in generate-nudge function:", error);
    return new Response(
      JSON.stringify({ nudge: "You're doing great—keep going at your own pace." }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});