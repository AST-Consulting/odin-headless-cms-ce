export interface InfographicPromptTemplate {
  key: string;
  label: string;
  description: string;
  promptSkeleton: string;
}

export const INFOGRAPHIC_PROMPT_TEMPLATES: Record<string, InfographicPromptTemplate> = {
  'ranking-board': {
    key: 'ranking-board',
    label: 'Ranking Board',
    description:
      'Best for top lists, league tables, scoreboards, and ordered performance summaries.',
    promptSkeleton:
      'Design a vertical ranking board infographic with numbered positions (1, 2, 3...). Each row should display: (1) large rank number in a circular badge on the left, (2) entity name/logo, (3) primary metric value in bold large font on the right, (4) optional secondary stats in smaller text. Use gradient colors: gold/yellow for #1, silver/gray for #2, bronze/orange for #3, and blue gradient for remaining positions. Add thin horizontal divider lines between rows. Include a header showing the ranking criteria. Use consistent left-to-right flow with proper alignment and spacing. Background should be clean white or light gradient.',
  },
  'comparison-cards': {
    key: 'comparison-cards',
    label: 'Comparison Cards',
    description:
      'Best for comparing 2-6 entities across the same metrics with side-by-side structure.',
    promptSkeleton:
      'Design a professional side-by-side comparison infographic with distinct card columns for each entity. Use a clean 2-column or 3-column grid layout with clear separation between items. Each card should have: (1) entity name/logo at top, (2) matching metrics listed vertically in same order, (3) values in large readable font with units, (4) use visual icons for each metric, (5) highlight key differences with color coding (green for advantages, red for disadvantages, or blue/orange for neutral contrast). Add a subtle background color to differentiate cards. Metric category labels (e.g. "Initial Cost", "Fuel Cost", "Maintenance") must appear inline inside each card next to the corresponding value — they must NOT appear as a separate tab bar, category strip, navigation row, or repeated legend above or outside the cards. The area above the cards should contain only the main title and optional short subtitle, nothing else. Use modern, minimal design with consistent spacing and alignment.',
  },
  timeline: {
    key: 'timeline',
    label: 'Timeline',
    description:
      'Best for event progression, milestones, policy evolution, and historical sequence.',
    promptSkeleton:
      'Create a clean vertical timeline infographic. LAYOUT: Center vertical line with events alternating left/right on a white background. DATES: Show the exact date or year in a large bold circular badge on the center line — must be clearly readable. EVENT CARDS: Each event gets a rounded rectangle card with a solid color background (alternate blue, purple, teal, green). Inside each card: event title in large bold white text at top, brief description in smaller regular white text below. Connecting line from the circle to the card. STRUCTURE: Chronological order top to bottom, earliest first. Include all milestones from the data. CRITICAL: Render only the actual event names, dates, and descriptions — do NOT include any design instructions, font sizes, or technical notes as visible text in the image. Background: clean white. Modern professional style with clear readable typography.',
  },
  'stat-highlight': {
    key: 'stat-highlight',
    label: 'Stat Highlight',
    description:
      'Best for one big KPI plus supporting numbers, quick briefings, and social share visuals.',
    promptSkeleton:
      'Create a bold social-media-ready stat graphic. One massive hero number dominates the center of the image (very large, thick font, white or orange #f58634). Behind the number, use a cinematic real-world photograph related to the topic as the full background — slightly darkened or with a dark gradient overlay so the number pops. Below the hero number, place a short one-line caption describing the stat. No grids, no cards, no icons, no supporting stats — just one powerful number, one line of context, and a striking photo background. Think Instagram story or Twitter share card. Clean, dramatic, high contrast. No neon, no futuristic effects, no cluttered layout.',
  },
};

export const INFOGRAPHIC_PROMPT_TEMPLATE_KEYS = Object.keys(INFOGRAPHIC_PROMPT_TEMPLATES);
