export const bookTopicPrompt = `
You are a content strategist. I will provide you with book content, and I need you to generate {numPosts} SEO-optimized blog post ideas based on this content.

Book Content:
{bookContent}

**Titles should be entirely in {language}**

Title should not contain any of the following:
 - **कक्षा** if the content is related to school subjects
 - **कक्षा 1** if the content is related to school subjects
 means "Class" in English.

Each blog title must follow these guidelines:
✅ Content Requirements:
    - Simple and easy to understand
    - Meaningful and practical (avoid overly technical or abstract topics)
    - Ideal for all readers
    - Written to attract clicks with useful, real-world value
    - Each post must belong to **exactly one** category from the list below

Distribute the {numPosts} blog post ideas **evenly** across the categories.

✅ SEO & Writing Rules:
- Blog Title should be **SEO-optimized** with relevant keywords and structured for search performance
- Titles should vary in structure, with some using questions, benefits, or actionable advice
- Do not use colons (:) or any punctuation that separates two title parts
- Select exactly one category from the provided list for each blog post

IMPORTANT TITLE GUIDELINES:
- DO NOT include any year (e.g., 2025, 2024) in the titles
- DO NOT reference time periods in titles
- DO NOT include difficulty levels (e.g., "Advanced", "Intermediate", "Beginner") in titles
- Focus on timeless, evergreen content
- Include action words and learning-focused keywords (e.g., "Learn", "Master", "Guide", "Tutorial")
- Use numbers and lists where appropriate (e.g., "10 Essential", "5 Best Practices")
- Include problem-solving keywords (e.g., "How to", "Solutions", "Strategies")
- Use proper title case capitalization:
  * Always capitalize the first word of the title
  * Capitalize important words like nouns, verbs, adjectives, and adverbs
  * Keep small words lowercase (a, an, the, and, but, or, for, in, on, at, to, etc.)
  * Only capitalize words that are important to the meaning of the title

✅ Tag Requirements:
- Generate 2 to 5 tags for each blog post
- Each tag must contain no more than 3 words
- Tags should be relevant to the blog topic
- **Remove any '#' or ':' symbols** from the tags.  
- Tags should help with content categorization and SEO

Format:
Return your response in valid JSON format (no triple backticks).

The structure should be:
 {{
      "blogs": [
        {{
          "title": "Post Title",
          "url": "post-slug",
          "categories": ["{randomCategory}"], //assign same category as send in the {randomCategory}
          "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"], // 2 to 5 tags, each with max 3 words, always in {language},
          "metaTitle": "SEO Title",
          "metaDescription": "SEO Description",
          "ogTitle": "Open Graph Title",
          "ogDescription": "Open Graph Description",
          "imagePrompt": "A highly detailed AI-generated image illustrating 'Post Title'. 
                          This image should visually represent themes related to title.",
          "imageCaption": "A concise and engaging description of 'Post Title' that summarizes its core idea in a visually compelling way.",
          "excerpt": "Generate a compelling and concise summary of the blog post. The excerpt should introduce the 'Post Title', highlight key takeaways, and entice readers to continue reading. Ensure it aligns with title's expertise and maintains an engaging tone. this should be in {language} language.",
    }}
    ]
}}`;
