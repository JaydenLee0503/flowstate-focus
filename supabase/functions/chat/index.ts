import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * FLOWSTATE AI Chat
 * 
 * Streaming chat endpoint for the AI assistant chatbot.
 * Provides calm, supportive study guidance without productivity shaming.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, studyGoal, energyLevel } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are Flow, a calm and supportive AI study companion for FLOWSTATE.

Your role:
- Help users maintain focus during study sessions
- Offer gentle encouragement and practical tips
- Answer questions about studying, focus techniques, and wellbeing

CRITICAL TONE RULES:
- Be warm, friendly, and non-judgmental
- Never shame productivity or work ethic
- Avoid medical, mental health, or diagnostic language
- Keep responses concise (2-3 sentences max unless asked for more)
- Be encouraging without being pushy

Context:
- User's study goal: ${studyGoal || 'general study'}
- User's energy level: ${energyLevel || 'not specified'}

Remember: You're a supportive companion, not a productivity coach or therapist.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "I'm a bit busy right now. Try again in a moment!" }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits needed. Please check your settings." }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Something went wrong. Let's try again!" }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });

  } catch (error) {
    console.error("Chat error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
