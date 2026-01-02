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
        model: "google/gemini-2.5-pro",
        messages: [
          {
            role: "system",
            content: `You are an expert ergonomics and study environment analyzer. Carefully examine webcam images to provide detailed assessments.

## POSTURE SCORING (0.0 to 1.0)
Analyze the person's sitting posture based on these criteria:

**Excellent (0.9-1.0):**
- Head aligned over shoulders, not jutting forward
- Shoulders relaxed and level, not hunched
- Back appears straight or naturally curved
- Sitting upright with good spinal alignment

**Good (0.7-0.8):**
- Slight forward head position
- Minor shoulder tension or slight hunch
- Generally upright but not perfect

**Fair (0.5-0.6):**
- Noticeable forward head lean
- Rounded shoulders
- Visible slouching
- Leaning to one side

**Poor (0.3-0.4):**
- Significant slouching or hunching
- Head far forward from shoulders
- Collapsed chest posture
- Very rounded upper back

**Very Poor (0.0-0.2):**
- Lying down or extremely slumped
- Head resting on hand/desk
- Completely disengaged posture

## PHONE DETECTION
Scan the ENTIRE image for phones/smartphones:
- In hands (holding, texting, scrolling)
- On desk/table surface
- On lap or nearby
- Screen visible or phone shape visible
- Even partially visible phones count

## DESK/ENVIRONMENT ANALYSIS
If desk surface is visible, check for:

**Clutter indicators (deskCluttered=true):**
- Multiple unrelated items scattered
- Food/drinks (not water)
- Gaming devices or controllers
- Multiple phones or tablets
- Toys or non-study items
- Excessive papers/books piled messily

**Clean desk (deskCluttered=false):**
- Organized study materials only
- Single water bottle is OK
- Laptop/monitor and keyboard
- Notebooks/textbooks neatly arranged
- Minimal items, focused setup

## LOOKING DOWN DETECTION
- Head tilted more than 30 degrees downward = lookingDown=true
- Looking at desk, lap, or below screen level
- Note: Looking down at notes is normal, combine with desk analysis

## DISTRACTION DETECTION (isDistracted=true if ANY):
- Looking away from screen/study area
- Using phone or holding phone
- Eyes closed or appearing drowsy
- Engaged with non-study items
- Turned away from workspace

Respond with ONLY valid JSON (no markdown, no backticks):
{"postureScore":0.8,"isDistracted":false,"phoneDetected":false,"lookingDown":false,"deskCluttered":false,"distractingItems":[],"brief":"Encouraging 5-10 word message"}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze this study session image. Evaluate posture precisely using the scoring criteria. Check thoroughly for phones and desk clutter. Return JSON only, no markdown."
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
