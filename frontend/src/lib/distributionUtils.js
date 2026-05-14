/**
 * Context-Aware AI Distribution Engine — distributionUtils.js
 *
 * Output format (strict JSON):
 * {
 *   twitter:   { breaking, thread, debate },
 *   linkedin:  string,
 *   instagram: { caption, imagePrompt },
 *   whatsapp:  string
 * }
 *
 * @param {Object} article  - { title, content, tags }
 * @param {string} tone     - 'serious' | 'viral' | 'emotional'
 */
export const generateDistributionContent = (article, tone = "serious") => {
  const { title = "", content = "", tags = [] } = article;

  // ─── 1. Article Type Detection ───────────────────────────────────────────────
  let type = "general";
  const lowerTitle = title.toLowerCase();
  if (
    lowerTitle.includes("breaking") ||
    lowerTitle.includes("alert") ||
    lowerTitle.includes("urgent") ||
    lowerTitle.includes("just in")
  ) {
    type = "breaking";
  } else if (
    content.length > 2000 ||
    tags.some((t) =>
      ["opinion", "analysis", "editorial", "viewpoint", "perspective"].includes(
        String(t).toLowerCase()
      )
    )
  ) {
    type = "opinion";
  }

  // ─── 2. Helpers ──────────────────────────────────────────────────────────────
  const getExcerpt = (maxLen = 200) => {
    const plain = content.replace(/<[^>]+>/g, " ").trim();
    const sentences = plain.split(/[.!?]+\s+/);
    for (const s of sentences) {
      if (s.length > 40 && s.length <= maxLen) return s.trim();
    }
    return plain.substring(0, maxLen).trim() + "…";
  };

  const getHashtags = (extras = []) => {
    const base =
      tags.length > 0
        ? tags.slice(0, 5).map((t) => `#${String(t).replace(/\s+/g, "")}`)
        : ["#Trending", "#MustRead"];
    return [...base, ...extras].join(" ");
  };

  const excerpt = getExcerpt(200);
  const shortExcerpt = getExcerpt(100);

  // ─── 3. Tone Config ──────────────────────────────────────────────────────────
  const toneConfig = {
    serious: {
      energy: "🧠",
      twitterOpener: "New insight worth reading:",
      linkedinOpener: "An important development that demands attention.",
      urgency: "This matters.",
      mood: "professional and analytical",
      lighting: "clean, soft natural light",
      colorTone: "minimal, muted blues and greys",
    },
    viral: {
      energy: "🔥",
      twitterOpener: "Nobody is talking about this—but they should be:",
      linkedinOpener: "Here's something that's reshaping the industry RIGHT NOW.",
      urgency: "Don't scroll past this.",
      mood: "energetic and dramatic",
      lighting: "dynamic, high-contrast cinematic lighting",
      colorTone: "bold, vibrant with high saturation",
    },
    emotional: {
      energy: "❤️",
      twitterOpener: "This stopped me in my tracks:",
      linkedinOpener: "Some stories remind us why this work matters.",
      urgency: "Share this with someone who needs to hear it.",
      mood: "warm, intimate and deeply human",
      lighting: "golden hour, soft warm glow",
      colorTone: "warm tones, amber and soft reds",
    },
  };
  const tc = toneConfig[tone] || toneConfig.serious;

  // ─── 4. Twitter ──────────────────────────────────────────────────────────────
  const generateTwitter = () => {
    if (type === "breaking") {
      return {
        breaking: `🚨 BREAKING: ${title}\n\n${shortExcerpt}\n\nStay updated. ${tc.energy}\n${getHashtags(["#BreakingNews", "#JustIn"])}`,
        thread: [
          `🧵 THREAD — ${title} ${tc.energy}\n\nHere's everything that actually matters. (1/)`,
          `2/ The core story:\n${excerpt}`,
          `3/ Why this is significant right now — this signals a pattern worth tracking closely.`,
          `4/ What sources on the ground are saying about the immediate impact.`,
          `5/ The ripple effect: Communities, industries, and decision-makers will all feel this differently.`,
          `6/ What to watch next: The next 48 hours are critical. Follow for live updates. ${tc.energy}`,
          `7/ Final take: Events like "${title}" don't happen in a vacuum. They're inflection points.\n\n${getHashtags(["#NewsThread"])}`,
        ].join("\n\n"),
        debate: `Serious question — should this have happened at all?\n\n"${title}"\n\nWhat's your honest take? ${tc.energy} 👇\n${getHashtags(["#PublicDebate"])}`,
      };
    }

    if (type === "opinion") {
      return {
        breaking: `${tc.energy} ${tc.twitterOpener}\n\n"${title}"\n\n${shortExcerpt}\n\n${tc.urgency}\n${getHashtags()}`,
        thread: [
          `🧵 ${tc.energy} Let's talk about why "${title}" changes everything. A thread.`,
          `2/ First, the scene:\n${excerpt}`,
          `3/ Here's what most coverage is missing — the structural reason this is happening.`,
          `4/ The data point that breaks conventional wisdom on this topic.`,
          `5/ Who benefits, who loses, and why the popular narrative gets it backwards.`,
          `6/ My take: This isn't just an opinion piece — it's a forecast. Bookmark this.`,
          `7/ What do YOU think? Drop your view below. ${tc.energy}\n${getHashtags()}`,
        ].join("\n\n"),
        debate: `Unpopular opinion: We've been framing "${title}" completely wrong.\n\nAgree or disagree? 🔥 or 🧊?\n${getHashtags()}`,
      };
    }

    return {
      breaking: `${tc.energy} ${tc.twitterOpener}\n\n${title}\n\n${shortExcerpt}\n\n${getHashtags()}`,
      thread: [
        `🧵 ${tc.energy} "${title}" — here's the full picture nobody's giving you.`,
        `2/ Context first:\n${excerpt}`,
        `3/ Key takeaway #1: This is bigger than the headline suggests.`,
        `4/ Key takeaway #2: The timing matters — here's why this is happening now.`,
        `5/ Key takeaway #3: The real impact will be felt in 90 days, not today.`,
        `6/ What this means for you: Depending on your field, here's what to prepare for.`,
        `7/ Wrap: "${title}" is worth more than a quick scroll. Read the full piece. ${tc.energy}\n${getHashtags()}`,
      ].join("\n\n"),
      debate: `Hot take: "${title}" is the most underreported story right now.\n\nWhy isn't everyone talking about this? ${tc.energy}\n${getHashtags()}`,
    };
  };

  // ─── 5. LinkedIn ─────────────────────────────────────────────────────────────
  const generateLinkedIn = () => {
    if (tone === "serious") {
      return `${tc.energy} ${tc.linkedinOpener}\n\n"${title}" is not just a headline — it's a signal.\n\n${excerpt}\n\nFor professionals watching this space, the implications are structural. The surface-level narrative misses what's really at stake: a shift in how industry, policy, and public trust interact. The teams and organizations that move early will define the category.\n\nI'll be tracking key indicators over the next quarter to gauge trajectory. If this aligns with your work, I'd value your perspective.\n\n👉 What's your read on the long-term impact?\n\n${getHashtags(["#Leadership", "#IndustryInsights", "#Strategy"])}`;
    }
    if (tone === "viral") {
      return `${tc.energy} Stop what you're doing and read this.\n\n"${title}"\n\n${excerpt}\n\nI've seen a lot of trend pieces this year. This one is different. The data, the timing, and the implications align in a way that only happens once in a cycle.\n\nIf you're a founder, operator, or investor and you're not tracking this — you might be the last to know.\n\n💬 What's your take? And more importantly, what are you doing about it?\n\n${getHashtags(["#Innovation", "#FutureOfWork", "#Growth"])}`;
    }
    return `${tc.energy} Some articles make you stop and reflect.\n\n"${title}" is one of them.\n\n${excerpt}\n\nBehind every story like this are real people — navigating uncertainty, showing resilience, and doing work that rarely gets the spotlight it deserves. We talk a lot about metrics and milestones. But the human dimension unfolding here is something we should sit with.\n\nTo anyone touched by this story: your experience matters.\n\n💬 What does this bring up for you?\n\n${getHashtags(["#Community", "#Empathy", "#HumanFirst"])}`;
  };

  // ─── 6. Instagram (caption + imagePrompt) ────────────────────────────────────
  const generateInstagram = () => {
    const hashtags = getHashtags(["#ExplorePage", "#MustRead", "#ContentCreator"]);

    // Caption
    let caption = "";
    if (tone === "viral") {
      caption = `${tc.energy} This is the story everyone will be talking about by end of week.\n\n"${title}"\n\n→ ${excerpt}\n\nHere's why it matters:\n⚡️ It's happening faster than anyone predicted.\n⚡️ The mainstream narrative is missing key context.\n⚡️ The people affected deserve more than a headline.\n\n${tc.urgency}\n\nLink in bio for the full read. 🔗\n.\n.\n.\n${hashtags}`;
    } else if (tone === "emotional") {
      caption = `${tc.energy} Sometimes a story just stays with you.\n\n"${title}"\n\n${excerpt}\n\nThere's something profound about moments like these —\nthey cut through the noise and remind us\nwhat actually matters.\n\nIf this resonates, share it with someone who needs it today. 💙\n\nFull story at the link in bio.\n.\n.\n.\n${hashtags}`;
    } else {
      caption = `${tc.energy} Worth your attention today.\n\n"${title}"\n\n${excerpt}\n\nKey insights:\n→ Context is everything.\n→ The details matter.\n→ The implications run deeper than they appear.\n\nFull article in bio. ✍️\n.\n.\n.\n${hashtags}`;
    }

    // Image Prompt — contextual, visual, Instagram-worthy
    const subjectHint = title.split(" ").slice(0, 4).join(" ");
    let imagePrompt = "";

    if (tone === "serious") {
      imagePrompt = `A cinematic, editorial-style photograph capturing the essence of "${subjectHint}". ${tc.mood} atmosphere. Subjects shown in a thoughtful, composed moment — a professional setting with papers, a city skyline in the background, or a newsroom environment. ${tc.lighting}. ${tc.colorTone} palette. Wide shot, slightly low angle for authority. Photorealistic, high resolution, modern editorial magazine style. No text overlays.`;
    } else if (tone === "viral") {
      imagePrompt = `A bold, high-energy, attention-grabbing visual inspired by "${subjectHint}". ${tc.mood} scene. Dynamic composition with a strong focal point — a crowd reacting, a dramatic moment frozen in time, or a powerful symbol of change. ${tc.lighting}. ${tc.colorTone} color grading. Rule of thirds composition, close-to-mid shot. Hyper-realistic, social media optimized, Instagram-worthy. No text overlays.`;
    } else {
      imagePrompt = `A warm, intimate, emotionally resonant photograph tied to the story of "${subjectHint}". ${tc.mood} scene — a person's expression of quiet strength, a community gathering, or hands reaching toward each other. ${tc.lighting} with soft bokeh background. ${tc.colorTone} film-like grain. Centered composition, close-up or portrait shot. Deeply human, authentic, and emotionally compelling. Photojournalism style. No text overlays.`;
    }

    return { caption, imagePrompt };
  };

  // ─── 7. WhatsApp ─────────────────────────────────────────────────────────────
  const generateWhatsApp = () => {
    if (tone === "viral") {
      return `${tc.energy} *You need to see this.*\n\n*${title}*\n\n→ ${shortExcerpt}\n\n${tc.urgency} Forward to your group! 📲`;
    }
    if (tone === "emotional") {
      return `${tc.energy} *This one made me stop scrolling.*\n\n*${title}*\n\n"${shortExcerpt}"\n\n${tc.urgency} 🙏`;
    }
    return `📢 *${title}*\n\n${shortExcerpt}\n\nFull article: [Link]\n\n${tc.urgency} Share if relevant to you.`;
  };

  // ─── 8. Return strict JSON ───────────────────────────────────────────────────
  return {
    twitter: generateTwitter(),
    linkedin: generateLinkedIn(),
    instagram: generateInstagram(),
    whatsapp: generateWhatsApp(),
  };
};
