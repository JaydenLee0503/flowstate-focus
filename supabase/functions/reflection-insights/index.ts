import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { averageFocusScore, sessionDuration, studyGoal, energyLevel } = await req.json();

    const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY");
    if (!GROQ_API_KEY) {
      throw new Error("GROQ_API_KEY is not configured");
    }

    const focusRating = averageFocusScore > 0.7 ? "excellent" : averageFocusScore > 0.5 ? "good" : averageFocusScore > 0.3 ? "moderate" : "needs improvement";
    const durationMins = Math.floor(sessionDuration / 60);

    const systemPrompt = `You are a supportive study coach providing brief, actionable insights after a study session. Keep responses concise (2-3 sentences max). Be encouraging but honest.`;

    const userPrompt = `The student just completed a ${durationMins} minute ${studyGoal || "study"} session.
Their average focus score was ${(averageFocusScore * 10).toFixed(1)}/10 (${focusRating}).
Their energy level was ${energyLevel || "unknown"}.

Provide a personalized insight about their session and one specific tip for their next session. Be brief and actionable.`;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Groq API error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limited. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      throw new Error(`Groq API error: ${response.status}`);
    }

    const data = await response.json();
    const insight = data.choices?.[0]?.message?.content || "Great job completing your session! Keep up the good work.";

    return new Response(
      JSON.stringify({ insight }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Reflection insights error:", error);
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : "Unknown error",
        insight: "Great job completing your study session! Remember to take breaks and stay hydrated."
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
