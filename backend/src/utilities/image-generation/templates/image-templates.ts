export interface ImageTemplate {
  description: string;
  promptWrapper: (topic: string) => string;
}

/**
 * News image templates — designed for professional photojournalistic output.
 * Style: DSLR-quality, real-world editorial photography with gravitas.
 * Primary brand colour: #f58634 (orange).
 * All templates enforce photorealism and ban AI/3D/toy/stock aesthetics.
 */
export const IMAGE_TEMPLATES: Record<string, ImageTemplate> = {
  'editorial-photo': {
    description: 'Photorealistic news scene or location shot. Good for general news stories.',
    promptWrapper: (topic: string) =>
      `Professional photojournalistic image for: "${topic}".
       Shot on 35mm DSLR, shallow depth of field, natural available light.
       Real-world location with authentic environment — show the actual place or context where this story happens.
       Realistic people with natural expressions and body language if relevant.
       Warm color grading with subtle orange tones (#f58634) in the lighting or environment.
       Style: Reuters/AP wire photo. Cinematic composition with rule of thirds.
       NEVER: text, labels, 3D renders, toy models, flat-lay, clip art, stock photo poses, neon, futuristic effects.`,
  },

  'sports-action': {
    description:
      'Real sports photography — players in action on ground. Good for match or tournament result news, NOT for rankings or stats.',
    promptWrapper: (topic: string) =>
      `Professional sports action photograph for: "${topic}".
       Shot on telephoto lens (200-400mm), fast shutter speed freezing motion, shallow depth of field.
       Players mid-action on the field — batting, bowling, kicking, running, celebrating.
       Real stadium environment with crowd blur in background, floodlights, green pitch.
       Sweat, intensity, emotion visible. Dynamic diagonal composition.
       Warm orange tones (#f58634) visible in stadium elements, jersey accents, or golden-hour lighting.
       Style: Getty Images sports photography. Raw and authentic.
       NEVER: posed shots, rankings, graphics, text, 3D renders, neon, digital overlays.`,
  },

  'sports-ranking': {
    description:
      'Sports ranking, player stats, team standings, or cricket/football/T20I/ODI leaderboard stories. Always choose this for any prompt that mentions ranking, top 10, leaderboard, stats, or batter/bowler ratings.',
    promptWrapper: (topic: string) =>
      `Create a sports ranking infographic for: "${topic}".
       Show a clear TOP 10 leaderboard layout with rank numbers like a simple list on full page.
       Use latest data.
       Include player cards with short stats (name, team, rating/runs).
       Table should have orange primary color (#f58634).
       Blurred stadium photo in background for depth — do NOT make it look like an action photo.
       Every card organized in a clean, easy-to-read format with clear rank numbers.
       Style: ESPN/Cricbuzz stats graphic. Professional and data-focused.
       NEVER: neon, futuristic effects, 3D renders, toy models.`,
  },

  portrait: {
    description:
      'Clean headshot or environmental portrait. Good for politician, sportsperson, or public figure stories.',
    promptWrapper: (topic: string) =>
      `Professional editorial portrait for: "${topic}".
       Shot on 85mm lens, f/1.8, creamy bokeh background. Natural window light or soft studio lighting.
       Subject in their real environment — office, parliament corridor, training ground, home.
       Authentic expression — confident, thoughtful, or determined. Not smiling at camera.
       Warm skin tones, subtle orange (#f58634) in background elements or clothing accent.
       Style: TIME magazine cover portrait. Commanding presence with depth.
       NEVER: text, overlays, 3D renders, stock photo smile, plain white background, neon effects.`,
  },

  'event-scene': {
    description:
      'Wide shot of a real event — press conference, gathering, ceremony. Good for political or social news.',
    promptWrapper: (topic: string) =>
      `Professional news event photograph for: "${topic}".
       Wide-angle shot (24-35mm) capturing the full scene with environmental context.
       Real venue — parliament house, press room with microphones, rally ground, conference hall, courtroom steps.
       Multiple people, podiums, flags, security detail — whatever fits the event naturally.
       Available light with dramatic shadows. Sense of scale and importance.
       Warm tones with orange (#f58634) in lighting, banners, or architectural elements.
       Style: Associated Press political/event photography. Documentary feel.
       NEVER: text, graphics, 3D renders, toy models, neon, stock photo aesthetics.`,
  },

  'concept-visual': {
    description:
      'Real-world scene representing an abstract concept. Good for economy, policy, health, tech, or opinion pieces.',
    promptWrapper: (topic: string) =>
      `Professional editorial photograph visualizing the concept: "${topic}".
       Show a REAL-WORLD scene that represents this topic — NOT symbolic objects on a table.
       Examples: for economy → trading floor or bank vault; for aviation → busy airport terminal or departure board;
       for healthcare → hospital corridor; for education → classroom; for technology → server room or office.
       Shot on DSLR, 35mm lens, natural light with dramatic shadows and depth of field.
       Real environment, real textures (glass, metal, concrete, wood), real scale.
       Warm color grading with orange tones (#f58634) in lighting or environment accents.
       Style: Bloomberg/Economist cover photography. Serious, atmospheric, cinematic.
       NEVER: toy models, miniatures, flat-lay, 3D renders, clip art, icons, plain backgrounds, neon, infographics, text.`,
  },
};

export const TEMPLATE_KEYS = Object.keys(IMAGE_TEMPLATES);

export const TEMPLATE_SELECTION_PROMPT = (userPrompt: string): string =>
  `Pick exactly one template key for this image request.

Request: "${userPrompt}"

Rules:
- ranking, top 10, leaderboard, stats, batter ranking, bowler ranking, standings -> sports-ranking
- match action, batting, bowling, fielding, tournament play -> sports-action
- one specific person -> portrait
- press event, rally, ceremony, summit, gathering -> event-scene
- policy, economy, opinion, abstract concept -> concept-visual
- otherwise -> editorial-photo

Templates available:
- editorial-photo: ${IMAGE_TEMPLATES['editorial-photo'].description}
- sports-action: ${IMAGE_TEMPLATES['sports-action'].description}
- sports-ranking: ${IMAGE_TEMPLATES['sports-ranking'].description}
- portrait: ${IMAGE_TEMPLATES['portrait'].description}
- event-scene: ${IMAGE_TEMPLATES['event-scene'].description}
- concept-visual: ${IMAGE_TEMPLATES['concept-visual'].description}

Reply with only one key from this list:
editorial-photo, sports-action, sports-ranking, portrait, event-scene, concept-visual`;
