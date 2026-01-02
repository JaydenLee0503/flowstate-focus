import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * FLOWSTATE Posture Analysis
 * 
 * Uses Gemini Vision to analyze webcam frames for posture/attention detection.
 * Returns a posture score (0-1) and distraction status.
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
    const { imageBase64 } = await req.json();
    
    if (!imageBase64) {
      return new Response(
        JSON.stringify({ error: "No image provided" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      return new Response(
        JSON.stringify({ 
          postureScore: 0.7, 
          isDistracted: false,
          analysis: "Vision analysis unavailable" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a posture and attention analyzer for a study focus app. Analyze the webcam image and assess:
1. Posture quality (is the person sitting upright, slouching, or leaning?)
2. Attention level (are they looking at the screen, looking away, or distracted?)

IMPORTANT: Be encouraging and non-judgmental. This is for gentle feedback, not criticism.

Respond ONLY with valid JSON in this exact format:
{
  "postureScore": <number between 0 and 1, where 1 is excellent posture>,
  "isDistracted": <boolean, true if looking away or appears unfocused>,
  "brief": "<one short encouraging observation, max 10 words>"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this webcam frame for posture and attention. Respond with JSON only."
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        console.log("Rate limited");
        return new Response(
          JSON.stringify({ postureScore: 0.7, isDistracted: false, analysis: "Rate limited" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        console.log("Payment required");
        return new Response(
          JSON.stringify({ postureScore: 0.7, isDistracted: false, analysis: "Credits needed" }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ postureScore: 0.7, isDistracted: false, analysis: "Analysis unavailable" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Parse JSON from response
    let result = { postureScore: 0.7, isDistracted: false, brief: "" };
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
    }

    console.log("Posture analysis:", result);

    return new Response(
      JSON.stringify({
        postureScore: Math.max(0, Math.min(1, result.postureScore || 0.7)),
        isDistracted: Boolean(result.isDistracted),
        analysis: result.brief || "Looking good!"
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-posture function:", error);
    return new Response(
      JSON.stringify({ 
        postureScore: 0.7, 
        isDistracted: false, 
        analysis: "Analysis error",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
