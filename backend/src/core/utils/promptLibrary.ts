export const promptLibrary = {
  SEOHeadingAudit: `
   You are a senior Technical SEO auditor. Perform a focused on-page SEO audit for the provided page HTML.

   Input URL: {url}
   Extracted HTML (truncated if very large):
   {html}

   Provide an actionable audit across these sections:
   1. Headings:
     - Extract unique H1, H2, H3 texts in order of first appearance (plain text only).
     - Flag issues: missing/multiple H1, skipped hierarchy, keyword stuffing, empty/very short/full-caps headings.
   2. Meta Tags:
     - Extract <title>, <meta name="description">, <meta name="keywords"> (if present).
     - Evaluate length & relevance. Flag duplicates / missing / too short / too long / weak keyword targeting.
     - Provide optimized suggestions for each missing or weak tag.
   3. Open Graph & Social:
     - List present og:* and twitter:* tags.
     - List missing recommended tags: og:title, og:description, og:type, og:url, og:image, twitter:card, twitter:title, twitter:description, twitter:image.
   4. Images:
     - List images missing alt or empty alt (limit to first 50). Provide suggested alt text (concise, descriptive, no stuffing).
     - If filename hints large (e.g., contains 'large', 'hero', mb indicators) or has no dimensions attributes, note potential optimization.
   5. Links:
     - Count internal vs external links (based on same hostname heuristic placeholder: treat links starting with '/' or containing the same root domain as internal—if domain ambiguous just classify by starting '/').
     - List suspicious links (href '#' or empty, javascript:void(0), duplicate anchors with identical href+text within first 100 links).
     - Flag non-descriptive anchor texts (e.g., 'click here', 'read more').
   6. Content:
     - Roughly estimate main text length (in words) ignoring script/style/nav/footer.
     - Infer primary topic and whether headings + title align.
     - Suggest improvements: add FAQs, restructure sections, add semantic headings, improve intro/CTA.
   7. Technical Signals:
     - Check for viewport meta presence.
     - Count inline <style> blocks & <script> tags (noting if many > 20).
     - Detect presence of structured data (script[type='application/ld+json']).
     - Note canonical link tag existence.
   8. Summary:
     - Provide overallHealth: one of "Good", "Moderate", "Needs Improvement".
     - Top 3 prioritized fixes (concise, high-impact).
     - Brief impactSummary (how fixes help SEO & UX).

  Output STRICT JSON (no code fences, no commentary). Schema:
  {
   "extractedHeadings": { "H1": string[], "H2": string[], "H3": string[],
      "issuesFound": string[],
      "suggestedSolutions": string[] 
   },
   "meta": { "title": string | null, "description": string | null, "keywords": string | null, "issues": string[], "suggested": { "title"?: string, "description"?: string, "keywords"?: string } },
   "openGraph": { "present": string[], "missing": string[] },
   "images": { "missingAlt": Array<{ "src": string, "suggestedAlt": string }>, "potentialOptimizationNotes": string[] },
   "links": { "counts": { "internal": number, "external": number }, "suspicious": string[], "nonDescriptiveAnchors": Array<{ "text": string, "href": string }> },
   "content": { "estimatedWordCount": number, "primaryTopic": string | null, "alignmentNotes": string[], "improvementIdeas": string[] },
   "technical": { "viewportPresent": boolean, "inlineStyleBlocks": number, "scriptTags": number, "structuredDataPresent": boolean, "canonicalPresent": boolean },
   "summary": { "overallHealth": string, "topFixes": string[], "impactSummary": string }
  }

   Rules:
   - Always include every top-level key exactly as specified.
   - Use null (not empty string) when a single-value meta tag is missing.
   - Arrays must exist (use [] if empty).
   - Avoid exaggerated claims; be factual.
   - No HTML tags in values; plain text only.
  `,

  'News-Main': `Act as an expert writer. Write a news article on '{topic}'
      The goal is to create a clear, informative, well-structured and reader-first article that
      covers the news story.
      The article needs to engage readers with accurate, timely reporting that maintains journalistic integrity.
      The content should be written in {language} language.

      ## Special Instructions: **{specialInstructions}**

      ## Follow the writing style from {domain} news website.

    Important:
      - Writing Style: {writingStyle}
      - The tone of this article should be {tone}.
      - Target Audience: {targetAudience}
      - Provide background context and key details about the story
      - Include relevant stakeholder perspectives.
      - The tone should be accessible to general news readers
      - Structure the article with proper headings and subheadings for clarity
      - DO NOT include the article headline or introduction - start directly with the first section
      - DO NOT include the news headline '{topic}' anywhere in the main sections
      
      ## Subheading Guidelines for Better Readability:
      - **Use simple, everyday words in subheadings** to maintain smooth reading flow from one section to the next
      - Write subheadings in easy-to-understand language that helps readers transition naturally between paragraphs
      - Avoid complex, technical, or jargon-heavy terms in subheadings - use common words that average readers can instantly grasp
      - Ensure subheadings create a natural bridge between sections for enhanced readability and comprehension
      - Keep subheadings concise but descriptive to guide readers through the content effortlessly
  
    Hey there! When you're generating content for a news website, follow these formatting guidelines to keep everything clean and editor-ready:
      - Start each section with an '<h3>' tag — that's your section heading.
      - **do not use any markdown tags only use html**
      - Use '<ul>' and '<li>' tags for bullet point lists.
      - If you're including official statements, quotes, or data, wrap those parts in '<blockquote>' blocks for proper attribution.
      - If you're presenting statistics, poll results, or comparisons, go with an HTML '<table>' for clarity.
      - No lead-in paragraphs or summaries before sections — each one should kick off directly with its '<h3>' heading.
      - Make sure your HTML is clean and works well inside the news CMS — no funky formatting.
      - Ensure that the key terms {keyword} are used naturally in the news article at the appropriate places.
      Stick to this structure and you'll have well-organized, news-ready content every time!
    
      CRITICAL LANGUAGE REQUIREMENTS:
        - Write ONLY in SIMPLE {language} language that common people can understand
        - DO NOT use any foreign words like "perkembangan", "development", etc.
        - If you must use English terms, use only basic ones like "computer", "mobile", "internet"
        - Use simple, everyday {language} vocabulary
        - **Do NOT include any author name**, byline, or any similar text in the article.
        - Do not add anyone's opinion, only facts and information
        
        Content Requirements:
        - Create a compelling, clear {language} headline that immediately tells what happened
        - Use simple, accessible language that common people can understand
        - Follow journalistic style with clear storytelling
        - Include proper introduction, background, current developments.
        - Strictly ensure total article is between 900 and 1000 words - do not exceed this limit
        - Make it comprehensive but easy to read

    Writing breaking news? Excellent — just keep these journalistic guidelines in mind to ensure your reporting really delivers:
      - Focus on factual reporting — let the reader understand what happened and what comes next
      - Ensure the content includes accurate and well-researched information
      - Ensure the information is factual, balanced, and transparent. avoid speculation, and write in a tone that reflects journalistic integrity
      - When explaining events, be clear and break it down so it's accessible to all readers
      - Include relevant data, statistics, or official documents where they support the story
      - **Please do not write conclusion here**

    Stick to these and you'll be producing content that's not just informative, but genuinely serves the public interest.`,

  Introduction: `
      Write a unique and engaging introduction for '{topic}' that captures attention and sets up the learning journey. 
      The content should be written in {language} language. 
      The keyword for this article is '{keyword}'.

      ## Special Instructions: **{specialInstructions}**

      Choose ONE of these topic-specific opening approaches based on the topic type: 
      Writing Style: 
      - Write as ONE focused paragraph 
      - Maximum 150 words 
      - Use active voice 
      - Make it focused and concise 
      - Keep it technical and informative 

      Content Uniqueness Guidelines: 
      - Use specific examples 
      - Include current trends 
      - Share unique insights 
      - Reference recent developments 

      IMPORTANT: 
      - Keep to ONE paragraph only 
      - Maximum 150 words 
      - DO NOT mention which approach you're using 
      - DO NOT include phrases like 'I've chosen the X approach' 
      - Use natural transitions between ideas 
      - DO NOT start with phrases like 'Here's an introduction' or 'This introduction' 
      - Start directly with the content without any meta-commentary 
      - DO NOT include any headings or section markers 
      - DO NOT use any HTML tags except <p> for paragraphs 
      - DO NOT add meta-commentary at the end of the introduction 
      - DO NOT mention 'this guide' or 'this article' 
      - DO NOT preview the content structure 
      - End the introduction naturally without additional context 
      - DO NOT add the title as a heading at the start of main sections
      - Keep the content natural and flowing 
      - NO bullet points 
      - NO headings 
      - Write in clear, connected sentences 
      - Start directly with content 
      - DO NOT mention 'this guide' or 'this article'
    `,

  Main: `Act as an expert blog writer. Write a in-depth, comprehensive article on '{topic}' and keyword is {keyword}
      The goal is to create a clear, informative, well-structured and people-first article that
      educates the reader on the given topic.
      The article needs to captivate readers that will get a high click-through rate (CTR)
      The content should be written in {language} language.
      ## Special Instructions: **{specialInstructions}**

    Important:
      - Writing Style: {writingStyle}
      - The tone of this article should be {tone}.
      - Target Audience: {targetAudience}
      - Definitions and explanations of key terms and technologies involved
      - A comparison of related components if applicable.
      - Real-world applications or use cases if applicable.
      - The tone should be educational and accessible to someone with a basic understanding of technology.
      - Structure the article with proper headings and subheadings for clarity.
      - DO NOT include the article title or introduction - start directly with the first section
      - DO NOT include the blog title '{topic}' anywhere in the main sections
  
    Hey there! When you're generating content for a WordPress article, follow these formatting guidelines to keep everything clean and editor-ready:
      - Start each section with an '<h3>' tag — that's your section heading.
      - **do not use any markdown tags only use html**
      - Use '<ul>' and '<li>' tags for bullet point.
      - If you're writing about technical stuff (like code, commands, etc.), wrap those parts in '<pre><code>'' blocks so they display properly.
      - If you're comparing things (tools, features, plans, etc.), go with an HTML '<table>' for clarity.
      - No lead-in paragraphs or summaries before sections — each one should kick off directly with its '<h3>' heading.
      - Make sure your HTML is clean and works well inside the WordPress editor — no funky formatting.
      - Ensure that the keyword '{keyword}' is used naturally in the blog post at the appropriate places.
      Stick to this structure and you'll have well-organized, WordPress-friendly content every time!

    Writing something solid? Awesome — just keep these guidelines in mind to make sure your content really delivers:
      - Include personal anecdotes, case studies, or real-world examples to show first-hand experience with the topic
      - Cite credible sources, reference recognized experts, and include quotes or references to authoritative institutions where appropriate
      - Focus on actionable takeaways — let the reader walk away with something they can apply.
      - Ensure the content includes detailed, accurate, and well-researched information that reflects deep knowledge in this field.
      - Ensure the information is factual, balanced, and transparent. Clearly mention sources, avoid exaggerated claims, and write in a tone that reflects integrity and accuracy
      - When explaining technical stuff, be clear and break it down so it's easy to understand.
      - And don't forget to include code samples or diagrams where relevant — they really help!
      - **Please do not write conclusion here**

    Stick to these and you'll be cranking out content that's not just informative, but genuinely helpful.`,

  Conclusion: `Write a unique and actionable conclusion for '{topic}' that reinforces key learnings. 
      The content should be written in {language} language. 
      Start with an <h2>Conclusion</h2> header in the {language} language. 
      ## Special Instructions: **{specialInstructions}**
      Writing Style: 
      - Keep it concise 
      - Write in flowing paragraphs 
      - Make it actionable 
      - Include personal tips 
      - End with motivation 
      - DO NOT use bullet points 
      - Connect ideas naturally 
      - Use transitions between concepts 

      Content Uniqueness Guidelines: 
      - Use specific examples 
      - Include current trends 
      - Share unique insights 
      - Add personal anecdotes 
      - Reference recent developments 

      Remember to: 
      - Keep total length under 200 words 
      - Focus on practical value 
      - Make it memorable 
      - Keep AI score below 10 
      - Ensure uniqueness in each article 
      - Write in flowing paragraphs, not bullet points 
      - Connect ideas with natural transitions 
      - DO NOT add any text before the Conclusion heading
      - Add some reference link for external linking purpose for SEO
      `,

  Faq: `The content should be written in {language} language.
      Create 6-8 FAQs (you pick the number) about '{topic}' with questions,
      Vary the question lengths and avoid overly formal phrasing. Skip hyperlinks or promotional stuff.
      The structure should be:
      {{
        "FAQ": [
          {{
            "Question": FAQs question,
            "Answer": FAQs answer,
          }}
        ]
      }}

      Do not include \`\`\`json or any other formatting, just return raw JSON.
      `,

  Recipe: `You are an expert chef and food journalist. Create a detailed recipe for '{topic}' in {language} language.
    Search the web to get accurate details about the recipe: Ingredients, Prep Time, Cook Time, and Category.
    
    Return ONLY a valid JSON object in the following format:
    {
      "title": "Recipe Title",
      "introduction": "Brief engaging introduction about the recipe.",
      "article": "The full recipe content in Markdown format. Structure: 1. Introduction, 2. Ingredients (as list), 3. Steps (as numbered list).",
      "prepTime": "HH:MM:SS format (e.g., 00:15:00 for 15 mins)",
      "cookTime": "HH:MM:SS format (e.g., 00:45:00 for 45 mins)",
      "totalTime": "HH:MM:SS format (e.g., 01:00:00 for 1 hour)",
      "recipeCategory": "Dessert, Main Course, Appetizer, etc.",
      "recipeCuisine": "Indian, Mughlai, Italian, etc.",
      "ingredients": [
        "ingredient 1",
        "ingredient 2"
      ],
      "steps": [
        "step 1",
        "step 2"
      ]
    }

    Rules:
    - Do not include any text before or after the JSON.
    - Do not use markdown backticks or code blocks.
    - {languageInstruction}
    `,

  MovieReview: `You are an expert movie critic and journalist. Create a detailed movie review for '{topic}' in {language} language.
    Search the web to get accurate details about the movie: Movie Name, Director, Main Actors, and Ratings.
    
    Return ONLY a valid JSON object in the following format:
    {
      "title": "Movie Review Title",
      "article": "The full review article in Markdown format. Structure: 1. Introduction, 2. Storyline, 3. Performance & Direction, 4. Final Verdict.",
      "movieName": "The exact name of the movie",
      "director": "Name of the director",
      "actors": "List of main actors, separated by newlines or commas",
      "ratingValue": "Rating out of 10 (e.g. 8.5)",
      "ratingCount": "Number of ratings (e.g. 500)",
      "bestRating": "Maximum possible rating (e.g. 10)",
      "reviewCount": "Number of reviews (e.g. 100)"
    }

    Rules:
    - Do not include any text before or after the JSON.
    - Do not use markdown backticks or code blocks.
    - {languageInstruction}
    `,

  PageSpeedAnalysis: `
    You are a web performance expert. Analyze the provided site audit data and provide actionable solutions.

    **Site Audit Data:**
    {siteAuditData}

    Analyze the data and provide practical solutions to fix performance issues. Focus on what developers can actually implement.

    Return a JSON response with solutions and recommendations. Be specific and actionable.
    
    Only return valid JSON without any markdown formatting.`,

  // AI Service Prompts

  SuggestTopics: `You are a newsroom editor. Given the category "{category}", suggest 5 trending and engaging article topic ideas that a journalist could write about right now. Each topic should be a short, descriptive phrase (10-20 words) that could serve as an article headline or topic description. Write in {language}. Return ONLY a JSON array of strings, no other text. Example: ["Topic idea 1", "Topic idea 2", "Topic idea 3", "Topic idea 4", "Topic idea 5"]`,

  GenerateOutline: `Create a concise, SEO-friendly article outline for the topic: "{topic}". The outline should be a list of key sections or headings. Return the response as a JSON array of strings. For example: ["Introduction", "Key Point 1", "Key Point 2", "Conclusion"].`,

  GenerateArticle: `Act as an expert journalist and researcher. Write a news article on '{topic}'
      The goal is to create a clear, informative, fact-rich, well-structured and reader-first article that
      covers the news story thoroughly with verifiable information.
      The article needs to engage readers with accurate, timely reporting that maintains journalistic integrity.
      {languageInstruction}

      Requirements:
      - Create a complete, publication-ready news article with multiple paragraphs
      - Include an engaging small introduction, detailed body sections
      - Use proper markdown formatting (headings, bold, italic, lists, etc.)
      - Make it SEO-friendly with relevant keywords naturally incorporated
      - Use ## for main section headings and ### for subsections
      - Use simple, everyday words in subsections to maintain smooth reading flow from one section to the next
      - Write in a professional yet engaging tone

      FACTS & DATA REQUIREMENTS (CRITICAL):
      - Include specific numbers, dates, percentages, and statistics wherever possible
      - Reference official sources: government reports, company statements, court filings, regulatory bodies
      - Include direct or paraphrased quotes from relevant authorities, experts, or officials
      - Mention specific names of people, organizations, places involved
      - Include timeline of key events with dates
      - Add comparison data where relevant (e.g., "up from X last year", "compared to Y in 2024")
      - If discussing financial matters, include exact figures (revenue, market cap, prices, growth rates)
      - If discussing policy/law, reference the specific act, section, or regulation
      - Every major claim should be backed by a who/what/when/where
      - ALL facts must be accurate and verifiable — do NOT fabricate statistics, quotes, or data points
      - If exact data is unavailable, use qualifiers like "approximately", "according to reports", "estimated"

      CRITICAL LANGUAGE REQUIREMENTS:
      - Write ONLY in SIMPLE language that common people can understand
      - DO NOT use any foreign words like "perkembangan", "development", etc.
      - If you must use English terms, use only basic ones like "computer", "mobile", "internet"
      - Use simple, everyday vocabulary
      - **Do NOT include any author name**, byline, or any similar text in the article.
      - Do not add anyone's opinion, only facts and information

      Content Requirements:
      - Create a compelling, clear headline that immediately tells what happened
      - Use simple, accessible language that common people can understand
      - Follow journalistic style with clear storytelling
      - Include proper introduction, background context, current developments, and future implications
      - Strictly ensure total article is between 900 and 1000 words - do not exceed this limit
      - Make it comprehensive but easy to read

      Journalistic Guidelines:
        - Focus on factual reporting — let the reader understand what happened and what comes next
        - Ensure the content includes accurate and well-researched information
        - Ensure the information is factual, balanced, and transparent. Avoid speculation, and write in a tone that reflects journalistic integrity
        - When explaining events, be clear and break it down so it's accessible to all readers
        - Include relevant data, statistics, or official documents where they support the story
        - Attribute information to sources (e.g., "according to...", "as reported by...", "data from X shows...")
        - **Please do not write conclusion here**

      STRUCTURE REQUIREMENTS:
      - Start with # Title (H1 heading) - this is your main article title
      - Then proceed directly with the article content (introduction, body sections, etc.)
      - Use ## for main section headings and ### for subsections

      IMPORTANT:
      - Return ONLY the markdown-formatted article content
      - Do NOT wrap the output in \`\`\`markdown or any code block syntax
      - Start directly with # Title
      - No preambles or explanations

      Return the article now:`,

  AnalyzeContent: `You are an expert content editor and writing coach. Analyze the following article and provide actionable, specific suggestions for improvement.

ARTICLE CONTENT:
{content}

ANALYSIS REQUIREMENTS:

You MUST provide 4-8 specific, actionable suggestions across these categories:
1. **Readability** - sentence complexity, clarity, jargon, passive voice
2. **Engagement** - hooks, storytelling, examples, emotional appeal
3. **Structure** - flow, transitions, paragraph organization, headings
4. **Tone** - voice consistency, audience alignment, formality

CRITICAL INSTRUCTIONS:
- Each suggestion MUST be specific to the actual content (quote exact phrases when relevant)
- Provide concrete, actionable advice (not generic "improve your writing" type suggestions)
- Mix severity levels based on actual issues found
- If the content is excellent, still provide suggestions for optimization or next-level improvements

EXAMPLES OF GOOD SUGGESTIONS:
{
  "category": "readability",
  "title": "Simplify the opening sentence",
  "description": "The first sentence is 47 words long and contains multiple clauses. Consider breaking it into 2-3 shorter sentences for better clarity. Example: Instead of 'When considering the complex interplay...', try 'Let's explore how X affects Y. Three key factors matter here.'",
  "severity": "high"
}

{
  "category": "engagement",
  "title": "Add a concrete example in paragraph 3",
  "description": "The concept of 'customer retention' is discussed abstractly. Add a real-world example or case study to make it tangible. For instance, how a specific company increased retention from 60% to 85%.",
  "severity": "medium"
}

{
  "category": "structure",
  "title": "Smooth the transition between sections 2 and 3",
  "description": "The jump from 'market analysis' to 'implementation strategy' feels abrupt. Add a transitional sentence like: 'Now that we understand the market landscape, let's explore how to execute effectively.'",
  "severity": "low"
}

Return ONLY a valid JSON object in this exact format (no markdown, no code blocks, no explanations):
{
  "suggestions": [
    {
      "category": "readability" | "engagement" | "structure" | "tone",
      "title": "Specific, actionable title",
      "description": "Detailed explanation with specific references to the content",
      "severity": "low" | "medium" | "high"
    }
  ],
  "summary": "2-3 sentence overall assessment highlighting key strengths and main areas for improvement",
  "scoreBreakdown": {
    "readability": <number 0-100>,
    "engagement": <number 0-100>,
    "structure": <number 0-100>,
    "tone": <number 0-100>
  }
}`,

  ImproveContent: {
    shorten: `Make this content more concise while preserving all key points and important information. Remove redundancy and wordiness.`,
    expand: `Expand this content with more details, examples, and explanations. Add depth while maintaining coherence.`,
    improve_intro: `Rewrite the introduction to be more engaging and compelling. Add a hook that captures attention immediately. Keep all other sections unchanged.`,
    add_conclusion: `Add a strong, impactful conclusion that summarizes key points and provides a clear takeaway or call-to-action. Keep all existing content intact.`,
    simplify: `Simplify the language to make it easier to understand. Use shorter sentences and common words. Maintain the meaning.`,
    add_examples: `Add 2-3 relevant, practical examples throughout the content to illustrate key points.`,
    formalize: `Rewrite this content in a more formal, professional tone. Use sophisticated vocabulary, remove casual expressions, and adopt a more authoritative voice. Maintain clarity while elevating the language.`,
  },

  ImproveContentTemplate: `{actionDescription}

Original Content:
{content}

IMPORTANT INSTRUCTIONS:
- Return ONLY the improved content itself, with no code blocks, no markdown fences, no explanations
- Do NOT wrap the output in \`\`\`markdown or any other code block syntax
- Use the same markdown formatting as the original (headings with #, lists with -, etc.)
- Preserve the original heading structure and paragraph breaks
- Start directly with the content (e.g., if it starts with # Title, your output should start with # Title)
- Do not add any preamble like "Here is the improved content:" or similar

Return the improved content now:`,

  ApplySuggestionFix: `You are an expert content editor. Apply ONLY the following specific fix to the article below. Make minimal changes — fix only what the suggestion describes, and preserve everything else exactly as-is.

SUGGESTION:
Category: {category}
Issue: {title}
Details: {description}

ARTICLE CONTENT:
{content}

IMPORTANT INSTRUCTIONS:
- Apply ONLY the fix described in the suggestion above — do NOT make any other changes
- Return ONLY the improved content itself, with no code blocks, no markdown fences, no explanations
- Do NOT wrap the output in \`\`\`markdown or any other code block syntax
- Use the same markdown formatting as the original (headings with #, lists with -, etc.)
- Preserve the original heading structure, paragraph breaks, and all content not related to the fix
- Start directly with the content (e.g., if it starts with # Title, your output should start with # Title)
- Do not add any preamble like "Here is the improved content:" or similar

Return the fixed content now:`,

  ExtractFactClaims: `You extract only factual claims from article draft segments.

TITLE: {title}
LANGUAGE: {language}
STRICTNESS: {strictness}

INPUT SEGMENTS:
{segments}

Return ONLY JSON in this shape:
{
  "claims": [
    {
      "blockId": "string",
      "quote": "short exact quote from the draft",
      "claim": "single factual claim rewritten clearly"
    }
  ]
}

Rules:
- Extract only atomic, checkable factual claims.
- Skip opinions, advice, marketing language, and vague statements.
- Prefer claims with names, dates, numbers, rankings, official actions, health/legal/statistical assertions, or current/latest wording.
- Keep quote and claim short.
- If LANGUAGE is Hindi (हिन्दी), the 'claim' field MUST be written in Hindi.
- Always rewrite 'claim' in the target LANGUAGE provided above.
- Do not invent claims not present in the input.
- Return at most 40 claims.`,

  JudgeFactClaims: `You are a strict fact-checking editor using grounded web search.

TITLE: {title}
LANGUAGE: {language}
STRICTNESS: {strictness}

CLAIMS TO VERIFY:
{claims}

Return ONLY JSON in this shape:
{
  "findings": [
    {
      "id": "optional",
      "blockId": "string",
      "quote": "short quote",
      "claim": "checked claim",
      "verdict": "contradicted | outdated | unsupported | needs_review",
      "severity": "high | medium | low",
      "confidence": 0.0,
      "reason": "one short sentence under 140 chars",
      "suggestedReplacement": "one short sentence under 180 chars",
      "suggestedAction": "replace | soften | attribute | review",
      "sources": [
        { "title": "Source title", "url": "https://example.com" }
      ]
    }
  ]
}

Rules:
- Return ONLY serious factual issues: false claim, outdated fact, unsupported stat/number, wrong date/name/rank/entity.
- Do not create an alert just because a statement lacks attribution or citation.
- Do not return anything unless there is a clear factual error or a source-backed factual conflict.
- If a claim is merely hard to verify quickly, omit it instead of forcing an alert.
- Use "unsupported" only for material numeric/statistical claims that authoritative sources do not support.
- Exclude weak editorial suggestions, wording advice, attribution preferences without factual risk, and low-signal issues.
- Be conservative. If uncertain, use "needs_review" or omit the item.
- Never invent a correction.
- Keep reason and suggestedReplacement very short.
- If LANGUAGE is Hindi (हिन्दी), write reason and suggestedReplacement in Hindi.
- Always respond in the target LANGUAGE for reason, suggestedReplacement, and findings.
- Prefer source-backed, attributed wording when certainty is limited.
- Use at most 2 sources per finding.
- Omit claims with no serious issue.
- Do not return paragraphs.`,

  GenerateSeoMetadata: `You are an expert SEO copywriter. Analyze the following article and create compelling metadata that drives clicks.

      {languageDirective}

      ARTICLE CONTENT:
      {contentSample}

      {currentTitleSection}

      Create SEO metadata with these requirements:

      **META TITLE (50-60 characters - STRICT LIMIT):**
      IMPORTANT: Stay UNDER 60 characters! Titles over 60 will be truncated with "..."
      - Aim for 50-58 characters to be safe
      - Use power words that trigger curiosity or urgency
      - Include the main keyword/topic naturally
      - Make it specific and benefit-focused
      {currentTitleInstruction}
      - Avoid generic phrases like "Learn about" or "Introduction to"

      **META DESCRIPTION (MAXIMUM 160 characters - ABSOLUTE HARD LIMIT):**
      IMPORTANT: Stay UNDER 160 characters! Anything longer will be automatically truncated with "..." 
      Count your characters carefully - aim for 150-158 to be safe!

      This is your chance to drive clicks - make every character count:

      DO:
      - Start with a strong hook or stat that grabs attention
      - Highlight the key benefit or value proposition
      - Use active voice and action words
      - Include specific details (numbers, outcomes, insights)
      - Create urgency or curiosity that makes users want to click
      - End with what they'll gain or discover
      - COUNT YOUR CHARACTERS - stay under 160!

      DON'T:
      - Use generic phrases like "This article discusses..." or "Learn more about..."
      - Be vague or summarize without value ("We explain X and Y")
      - Use passive voice
      - Just list topics without showing value
      - Waste characters on filler words
      - Go over 160 characters (will be truncated!)

      GOOD EXAMPLES (all under 160 chars):
      - "Discover 7 proven strategies that increased conversion rates by 340% for SaaS companies. Expert insights backed by real data." (132 chars)
      - "Why 89% of marketers fail at SEO—and how to avoid the same costly mistakes. Science-backed tactics that actually work." (119 chars)
      - "Master Python in 30 days with this step-by-step roadmap. Includes real projects, code examples, and expert tips for beginners." (127 chars)

      BAD EXAMPLES:
      - "This article talks about SEO and how it can help your business grow." (Too vague, no specifics)
      - "Learn more about the benefits of exercise and fitness." (Generic, no hook)
      - "We discuss various marketing strategies in detail and provide comprehensive insights." (Too long, no value)

      **ENGLISH HEADLINE:**
      - **MUST be written in English ONLY, regardless of the article's language — this is a hard requirement.**
      - If the article is already in English, this is the same as the main title.
      - If the article is in any other language (Hindi, Bengali, Tamil, etc.), translate the main title into natural, idiomatic English. Do NOT transliterate; do NOT leave non-English words.
      - Used for slug generation, image prompts, and SEO — it breaks downstream systems if it's not English.
      - No fixed length requirement — make it clear and descriptive.

      **TAGS (2-5 tags):**
      - Each tag must contain no more than 3 words
      - Tags should be relevant to the blog topic
      - Remove any '#' or ':' symbols
      - Tags should help with content categorization and SEO
      - **IMPORTANT: Tags MUST be in English only, regardless of the article's language**

      IMPORTANT: 
      - TITLE: Aim for 50-58 characters. Over 60 = automatic truncation with "..."
      - DESCRIPTION: Write a complete sentence within 160 characters. Over 165 = automatic truncation with "..."
      - Both will be CUT OFF at word boundaries if too long
      - Do NOT write long text thinking it can be edited later!

      Return ONLY this JSON (no markdown, no explanations):
      {
        "title": "Your compelling title (50-58 chars - truncated if over 60)",
        "description": "Your high-converting description (150-158 chars - truncated if over 165)",
        "englishHeadline": "English version of the title (no length limit)",
        "tags": ["tag1", "tag2", "tag3"]
      }`,

  TranslateContent: `Translate the following content to {languageName}.

Original Content:
{content}

IMPORTANT INSTRUCTIONS:
- Translate ALL text to {languageName}, including headings, paragraphs, lists, etc.
- Preserve markdown formatting exactly (headings with #, lists with -, bold with **, etc.)
- Maintain the original structure and meaning
- Use natural, fluent {languageName} that sounds like a native speaker
- For {additionalInstruction}
- Keep technical terms that are commonly used in {languageName}
- Do NOT add any explanations, preambles, or code block wrappers
- Return ONLY the translated content, starting directly with the translated text

Return the translated content now:`,

  GenerateContent: `
        Generate content based on this request: {prompt}

        Requirements:
        - Use markdown formatting
        - Be clear and concise
        - Maximum length: approximately {maxLength} words
        - Use proper headings, lists, and formatting where appropriate
        - Make it professional and well-structured

        Content:
        `,

  TrendingTopics: `Search for today's top 10 news headlines from India. Find current stories being covered by major Indian news outlets.

    For each headline provide:
    - topic: English headline (max 100 characters)
    - hindiTopic: Hindi translation of the headline
    - freshness: "New", "Recent", or "Trending"
    - category: "National"

    Respond with ONLY a valid JSON array containing exactly 10 items:

    [{"topic": "Headline here", "hindiTopic": "हिंदी में", "freshness": "New", "category": "National"}]`,

  GenerateWebStoryTemplate: `
You are an expert AMP Story developer, motion designer, and UI/UX specialist.

Your task is to generate a premium, production-ready AMP Story template.

---

TEMPLATE DESCRIPTION: {description}

---

CORE OBJECTIVE:
Create a visually stunning, mobile-first AMP Story layout with smooth animations, strong typography, and zero layout breakage.

---

CRITICAL OUTPUT RULES (MUST FOLLOW):

- Return ONLY valid JSON
- Do NOT include any explanation
- Do NOT include "Here is", "Output", or any extra text
- Do NOT use markdown or backticks
- Response MUST start with { and end with }
- HTML must be a SINGLE STRING (escaped properly)
- CSS must be a SINGLE STRING

---

REQUIREMENTS:

1. AMP STORY HTML:

- Use:
  - <amp-story-page>
  - <amp-story-grid-layer template="fill|vertical|thirds">
- Proper layering: background + content

---

2. CONTENT RULES (STRICT):

- ONLY ONE heading → {{headline}}
- ONLY ONE description → {{description}}
- NO CTA
- NO extra text

---

3. PLACEHOLDERS:

Use ONLY:
- {{headline}}
- {{description}}
- {{background_image}}

---

4. DESIGN:

- Premium UI (glassmorphism, gradients, shadows)
- Mobile-first responsive
- High contrast readability

---

5. CSS RULES:

- No overflow
- No clipping
- Use flexbox
- Add safe padding
- Ensure responsiveness

---

6. ANIMATIONS:

- Use AMP animations:
  fade-in, fly-in, zoom-in, slide-in, drop, bounce
- Smooth + staggered timing

---

7. IMAGE:

- Full screen background
- Proper cover
- Gradient overlay for readability

---

OUTPUT FORMAT (STRICT JSON):

{
  "name": "string",
  "html": "string",
  "css": "string",
  "allowedFields": ["headline", "description", "background_image"]
}

RETURN JSON ONLY.
`,

  // ─── Distribution Engine Prompts ─────────────────────────────────────────────

  GenerateDistributionPack: `You are an expert social media strategist, storyteller, and content director.

Your task is to generate high-quality, platform-specific content from a news/blog article.

---

# INPUT

Article Title: {title}

Article Content:
{content}

Tags: {tags}

Tone: {tone}

---

# CORE RULES

* Understand the article deeply — DO NOT just summarize, extract key insights
* Each platform must feel completely native
* Avoid generic phrases
* Tone drives the voice: serious=analytical/clean, viral=bold/energetic, emotional=human/relatable

---

# TWITTER (X)

1. breaking — 1 short punchy tweet (max 240 chars). Hook + key insight + hashtags.
2. thread — 5-7 tweets numbered (1/, 2/, ...). Each = one key insight. Last tweet has CTA + hashtags.
3. debate — 1 strong opinion-based question to drive engagement. Include hashtags.

---

# LINKEDIN

* Professional, insightful tone
* 3 paragraphs: (1) hook/context, (2) analysis + impact, (3) future implications
* End with a discussion question and hashtags

---

# INSTAGRAM

caption — Storytelling format. Strong hook first line. Short readable lines. Key insight + emotional angle + CTA. Hashtags.

coverSlide — "Slide 0: Cover Slide". Headline (2-6 bold words), body (1-2 tight sentences), and emoji (1 relevant emoji). This slide should summarize the entire article in a high-impact way.

carousel — Exactly 5 slides:
  Slide 1: Hook — bold opening question/statement
  Slide 2: Context — what is happening and why now
  Slide 3: Key insight #1 — most important finding
  Slide 4: Key insight #2 — second angle or implication
  Slide 5: CTA — what readers should do or think next

Each slide: headline (2-6 bold words), body (1-2 tight sentences), emoji (1 relevant emoji)

---

# WHATSAPP

2-4 lines. Bold title with *asterisks*. Hook + insight + CTA to forward.

---

# OUTPUT (STRICT JSON — NO EXTRA TEXT)

{
  "twitter": { "breaking": "", "thread": "", "debate": "" },
  "linkedin": "",
  "instagram": {
    "caption": "",
    "coverSlide": { "headline": "", "body": "", "emoji": "" },
    "carousel": [
      { "headline": "", "body": "", "emoji": "" },
      { "headline": "", "body": "", "emoji": "" },
      { "headline": "", "body": "", "emoji": "" },
      { "headline": "", "body": "", "emoji": "" },
      { "headline": "", "body": "", "emoji": "" }
    ]
  },
  "whatsapp": ""
}

Return ONLY valid JSON. No markdown fences. No explanations.`,
};

