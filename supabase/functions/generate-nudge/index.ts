import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * FLOWSTATE Nudge Generator
 * 
 * This edge function generates calm, supportive AI nudges based on the user's
 * current attention/posture state. It acts as a COMMUNICATION LAYER only -
 * the decision logic (isDistracted) is handled by the client.
 * 
 * Tone rules:
 * - Non-judgmental
 * - Calm and encouraging
 * - No productivity shaming
 * - No medical/mental health language
 * - No commands (avoid "you must", "stop", "fix")
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Fallback messages when LLM is unavailable
const FALLBACK_MESSAGES = {
  distracted: "It looks like your posture dipped a bit—want to reset comfortably before continuing?",
  focused: "Nice focus so far. Staying relaxed can help you keep this momentum."
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { isDistracted, studyGoal, energyLevel } = await req.json();
    
    const XAI_API_KEY = Deno.env.get('XAI_API_KEY');
    if (!XAI_API_KEY) {
      console.log("XAI_API_KEY not configured, using fallback");
      return new Response(
        JSON.stringify({ 
          nudge: isDistracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build context-aware system prompt
    const systemPrompt = `You are a calm, supportive study companion for FLOWSTATE, a focus app. 
Generate ONE short sentence (max 20 words) that gently encourages the user.

CRITICAL TONE RULES:
- Be non-judgmental and supportive
- Never shame productivity or work ethic
- Avoid medical or mental health language
- Never use commands like "you must", "stop", "fix"
- Keep it warm, human, and encouraging

Context:
- Study goal: ${studyGoal || 'general study'}
- Energy level: ${energyLevel || 'medium'}
- Current state: ${isDistracted ? 'posture has dipped slightly' : 'good focus and posture'}

Respond with ONLY the nudge sentence, no quotes or punctuation at the start.`;

    // Use Grok API (xAI)
    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${XAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "grok-2-latest",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: isDistracted 
            ? "Generate a gentle nudge about posture/reset" 
            : "Generate an encouraging message about their focus" 
          }
        ],
      }),
    });

    if (!response.ok) {
      // Handle rate limiting gracefully
      if (response.status === 429) {
        console.log("Rate limited, using fallback");
        return new Response(
          JSON.stringify({ 
            nudge: isDistracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.log("Payment required, using fallback");
        return new Response(
          JSON.stringify({ 
            nudge: isDistracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused 
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ 
          nudge: isDistracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const nudge = data.choices?.[0]?.message?.content?.trim() || 
      (isDistracted ? FALLBACK_MESSAGES.distracted : FALLBACK_MESSAGES.focused);

    console.log("Generated nudge:", nudge);

    return new Response(
      JSON.stringify({ nudge }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in generate-nudge function:", error);
    return new Response(
      JSON.stringify({ 
        nudge: FALLBACK_MESSAGES.focused,
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
