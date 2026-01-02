import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

/**
 * FLOWSTATE Posture & Environment Analysis
 * 
 * Uses Gemini Vision to analyze webcam frames for:
 * - Posture/attention detection
 * - Phone detection (distraction signal)
 * - Desk clutter analysis (when looking down)
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
          phoneDetected: false,
          deskCluttered: false,
          lookingDown: false,
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
            content: `You are a study environment analyzer for a focus app. Analyze the webcam image and assess:

1. POSTURE: Is the person sitting upright, slouching, or leaning?
2. ATTENTION: Are they looking at the screen, looking away, or looking down at their desk?
3. PHONE DETECTION: Is there a phone/smartphone visible in the frame? (in hand, on desk, anywhere visible)
4. DESK ANALYSIS: If the camera shows a desk/table surface (user looking down), are there distracting items visible? (phones, unrelated items, clutter)
5. LOOKING DOWN: Is the user's head tilted down significantly, suggesting they're looking at their desk/table?

IMPORTANT GUIDELINES:
- Be encouraging and non-judgmental in the "brief" message
- If a phone is detected, gently mention it
- If looking at a cluttered desk, kindly suggest tidying up
- Focus on the most important observation

Respond ONLY with valid JSON in this exact format:
{
  "postureScore": <number 0-1, where 1 is excellent posture>,
  "isDistracted": <boolean, true if looking away, at phone, or unfocused>,
  "phoneDetected": <boolean, true if a phone/smartphone is visible anywhere>,
  "lookingDown": <boolean, true if user is looking down at desk/table>,
  "deskCluttered": <boolean, true if desk has distracting items visible>,
  "distractingItems": <array of strings listing distracting items seen, e.g. ["phone", "game controller"]>,
  "brief": "<one short encouraging observation, max 15 words>"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this webcam frame for posture, attention, phone detection, and desk environment. Respond with JSON only."
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
      const fallbackResponse = { 
        postureScore: 0.7, 
        isDistracted: false,
        phoneDetected: false,
        deskCluttered: false,
        lookingDown: false,
        distractingItems: [],
        analysis: "Analysis unavailable" 
      };
      
      if (response.status === 429) {
        console.log("Rate limited");
        return new Response(JSON.stringify(fallbackResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      if (response.status === 402) {
        console.log("Payment required");
        return new Response(JSON.stringify(fallbackResponse), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify(fallbackResponse), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || "";
    
    // Parse JSON from response
    let result = { 
      postureScore: 0.7, 
      isDistracted: false, 
      phoneDetected: false,
      lookingDown: false,
      deskCluttered: false,
      distractingItems: [],
      brief: "" 
    };
    
    try {
      // Extract JSON from response (handle markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
    }

    // Determine distraction level based on multiple factors
    const isDistractedOverall = result.isDistracted || result.phoneDetected || 
      (result.lookingDown && result.deskCluttered);
    
    // Adjust posture score if phone detected or desk is cluttered
    let adjustedPostureScore = result.postureScore || 0.7;
    if (result.phoneDetected) {
      adjustedPostureScore = Math.min(adjustedPostureScore, 0.4);
    }
    if (result.lookingDown && result.deskCluttered) {
      adjustedPostureScore = Math.min(adjustedPostureScore, 0.5);
    }

    // Generate appropriate message based on findings
    let analysisMessage = result.brief || "Looking good!";
    if (result.phoneDetected) {
      analysisMessage = "Phone spotted! Maybe tuck it away for better focus.";
    } else if (result.lookingDown && result.deskCluttered) {
      analysisMessage = "Your desk looks busy—a quick tidy might help focus.";
    } else if (result.lookingDown) {
      analysisMessage = "Taking notes? Great! Keep that posture comfortable.";
    }

    console.log("Environment analysis:", {
      postureScore: adjustedPostureScore,
      isDistracted: isDistractedOverall,
      phoneDetected: result.phoneDetected,
      lookingDown: result.lookingDown,
      deskCluttered: result.deskCluttered,
      distractingItems: result.distractingItems
    });

    return new Response(
      JSON.stringify({
        postureScore: Math.max(0, Math.min(1, adjustedPostureScore)),
        isDistracted: isDistractedOverall,
        phoneDetected: Boolean(result.phoneDetected),
        lookingDown: Boolean(result.lookingDown),
        deskCluttered: Boolean(result.deskCluttered),
        distractingItems: result.distractingItems || [],
        analysis: analysisMessage
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error("Error in analyze-posture function:", error);
    return new Response(
      JSON.stringify({ 
        postureScore: 0.7, 
        isDistracted: false,
        phoneDetected: false,
        lookingDown: false,
        deskCluttered: false,
        distractingItems: [],
        analysis: "Analysis error",
        error: error instanceof Error ? error.message : "Unknown error"
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
