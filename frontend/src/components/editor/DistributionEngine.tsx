"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Twitter, 
  Linkedin, 
  Instagram, 
  MessageCircle, 
  Copy, 
  Sparkles, 
  Brain, 
  Flame, 
  Heart,
  Check,
  Share2,
  Loader2
} from "lucide-react";
import { toast } from "sonner";
import { generateDistributionPack } from "@/lib/api";

interface GeneratedContent {
  twitter: {
    breaking: string;
    thread: string;
    debate: string;
  };
  linkedin: string;
  instagram: {
    caption: string;
    coverSlide: {
      headline: string;
      body: string;
      emoji: string;
      imageUrl?: string;
    };
    carousel: Array<{
      headline: string;
      body: string;
      emoji: string;
      imageUrl?: string;
    }>;
  };
  whatsapp: string;
}

interface CopiedStates {
  [key: string]: boolean;
}

interface DistributionEngineProps {
  title: string;
  content: string;
  tags?: string[];
}

export default function DistributionEngine({ title, content, tags = [] }: DistributionEngineProps) {
  const [selectedTone, setSelectedTone] = useState("serious");
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedStates, setCopiedStates] = useState<CopiedStates>({});
  
  // Connection States (Mock)
  const [connections, setConnections] = useState<Record<string, boolean>>({
    twitter: false,
    linkedin: false,
    instagram: false,
    whatsapp: true, // Always "connected" as it's a deep link
  });

  const [isSharing, setIsSharing] = useState<Record<string, boolean>>({});

  const handleGenerate = async () => {
    if (!title) return;
    setIsGenerating(true);
    
    try {
      const result = await generateDistributionPack({
        title,
        content,
        tags,
        tone: selectedTone
      });
      setGeneratedContent(result);
      toast.success("AI Distribution pack generated!");
    } catch (error) {
      console.error(error);
      toast.error("Generation failed. Please try again.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConnect = (platform: string) => {
    toast.info(`Connecting to ${platform}...`);
    setTimeout(() => {
      setConnections(prev => ({ ...prev, [platform]: true }));
      toast.success(`Successfully connected to ${platform}!`);
    }, 1000);
  };

  const handleShare = (platform: string, text: string) => {
    setIsSharing(prev => ({ ...prev, [platform]: true }));
    toast.info(`Posting to ${platform}...`);
    
    setTimeout(() => {
      setIsSharing(prev => ({ ...prev, [platform]: false }));
      toast.success(`Successfully posted to ${platform}!`);
    }, 2000);
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedStates((prev) => ({ ...prev, [key]: true }));
    toast.success("Copied to clipboard");
    setTimeout(() => {
      setCopiedStates((prev) => ({ ...prev, [key]: false }));
    }, 2000);
  };

  const tones = [
    { id: "serious", label: "Serious", icon: <Brain className="w-4 h-4 mr-2" />, emoji: "🧠" },
    { id: "viral", label: "Viral", icon: <Flame className="w-4 h-4 mr-2" />, emoji: "🔥" },
    { id: "emotional", label: "Emotional", icon: <Heart className="w-4 h-4 mr-2" />, emoji: "❤️" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="text-lg font-semibold">Distribution Engine</h3>
          <p className="text-sm text-muted-foreground">
            Generate platform-optimized content with AI
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tones.map((tone) => (
            <Button
              key={tone.id}
              variant={selectedTone === tone.id ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedTone(tone.id)}
              className="rounded-full"
            >
              {tone.icon} {tone.label}
            </Button>
          ))}
        </div>

        <Button 
          onClick={handleGenerate} 
          disabled={isGenerating || !title}
          className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition-all duration-200"
        >
          {isGenerating ? (
            <Sparkles className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4 mr-2" />
          )}
          Generate Distribution Pack
        </Button>
      </div>

      {generatedContent && (
        <div className="grid gap-4 mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Twitter Card */}
          <Card className="overflow-hidden border-blue-100 dark:border-blue-900 shadow-sm">
            <CardHeader className="bg-blue-50/50 dark:bg-blue-900/10 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-500 rounded-lg text-white">
                    <Twitter className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-sm font-bold">Twitter Pack</CardTitle>
                </div>
                {!connections.twitter ? (
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] border-blue-200 text-blue-600" onClick={() => handleConnect('twitter')}>Connect X</Button>
                ) : (
                  <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">Connected</Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {Object.entries(generatedContent.twitter).map(([key, text]) => (
                <div key={key} className="space-y-2 group">
                  <div className="flex items-center justify-between uppercase tracking-wider text-[10px] font-bold text-muted-foreground">
                    <span>{key} Style</span>
                    <div className="flex items-center gap-1">
                      {connections.twitter && (
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 px-2 text-blue-600 hover:bg-blue-50 text-[10px]"
                          onClick={() => handleShare('twitter', text)}
                          disabled={isSharing.twitter}
                        >
                          {isSharing.twitter ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Twitter className="w-3 h-3 mr-1" />}
                          Post
                        </Button>
                      )}
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => copyToClipboard(text, `twitter-${key}`)}
                      >
                        {copiedStates[`twitter-${key}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </div>
                  <div className="p-3 bg-muted/40 rounded-lg text-sm italic border-l-2 border-blue-500">
                    "{text}"
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* LinkedIn Card */}
          <Card className="overflow-hidden border-indigo-100 dark:border-indigo-900 shadow-sm">
            <CardHeader className="bg-indigo-50/50 dark:bg-indigo-900/10 pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
                    <Linkedin className="w-4 h-4" />
                  </div>
                  <CardTitle className="text-sm font-bold">LinkedIn Article</CardTitle>
                </div>
                <div className="flex items-center gap-2">
                   {!connections.linkedin ? (
                    <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] border-indigo-200 text-indigo-600" onClick={() => handleConnect('linkedin')}>Connect</Button>
                  ) : (
                    <Button 
                      size="sm" 
                      variant="default" 
                      className="h-7 px-2 text-[10px] bg-indigo-600 hover:bg-indigo-700 font-bold"
                      onClick={() => handleShare('linkedin', generatedContent.linkedin)}
                      disabled={isSharing.linkedin}
                    >
                      {isSharing.linkedin ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Share2 className="w-3 h-3 mr-1" />}
                      Post Now
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8"
                    onClick={() => copyToClipboard(generatedContent.linkedin, 'linkedin')}
                  >
                    {copiedStates['linkedin'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              <div className="p-4 bg-muted/40 rounded-lg text-sm leading-relaxed border-l-2 border-indigo-600 whitespace-pre-wrap">
                {generatedContent.linkedin}
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4">
            {/* Instagram Card */}
            <Card className="overflow-hidden border-pink-100 dark:border-pink-900 shadow-sm">
              <CardHeader className="bg-pink-50/50 dark:bg-pink-900/10 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 rounded-lg text-white">
                      <Instagram className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-sm font-bold">Instagram</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {!connections.instagram ? (
                      <Button size="sm" variant="outline" className="h-7 px-2 text-[10px] border-pink-200 text-pink-600" onClick={() => handleConnect('instagram')}>Connect</Button>
                    ) : (
                       <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 text-pink-600 p-0"
                        onClick={() => handleShare('instagram', generatedContent.instagram.caption)}
                        disabled={isSharing.instagram}
                      >
                        {isSharing.instagram ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(generatedContent.instagram.caption, 'instagram')}
                    >
                      {copiedStates['instagram'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                <div className="space-y-3">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1.5">Caption</p>
                  <div className="p-3 bg-muted/40 rounded-lg text-xs italic border-l-2 border-pink-500 whitespace-pre-wrap">
                    {generatedContent.instagram.caption}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">🎨 Cover Slide</p>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => copyToClipboard(`${generatedContent.instagram.coverSlide.headline}\n${generatedContent.instagram.coverSlide.body}`, 'instagram-cover')}
                    >
                      {copiedStates['instagram-cover'] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    </Button>
                  </div>
                  <div className="group relative p-3 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/40 dark:to-blue-900/40 border border-indigo-200 dark:border-indigo-800 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                    {generatedContent.instagram.coverSlide.imageUrl && (
                      <div className="mb-3 rounded-lg overflow-hidden border border-indigo-100 dark:border-indigo-800">
                        <img src={generatedContent.instagram.coverSlide.imageUrl} alt="Cover Slide" className="w-full aspect-[4/5] object-cover" />
                      </div>
                    )}
                    <div className="flex items-start gap-3">
                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 text-[10px] font-bold shrink-0">
                        0
                      </span>
                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-indigo-700 dark:text-indigo-400 flex items-center gap-1.5">
                          {generatedContent.instagram.coverSlide.emoji} {generatedContent.instagram.coverSlide.headline}
                        </h4>
                        <p className="text-[11px] text-muted-foreground leading-snug">
                          {generatedContent.instagram.coverSlide.body}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {generatedContent.instagram.carousel && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
                      📑 Carousel Slides (5 slides)
                    </p>
                    <div className="grid gap-2">
                      {generatedContent.instagram.carousel.map((slide, i) => (
                        <div key={i} className="group relative p-3 bg-gradient-to-br from-white to-gray-50 dark:from-gray-900 dark:to-gray-950 border border-pink-100 dark:border-pink-900/30 rounded-xl shadow-sm hover:shadow-md transition-all duration-200">
                          {slide.imageUrl && (
                            <div className="mb-3 rounded-lg overflow-hidden border border-pink-100 dark:border-pink-900/20">
                              <img src={slide.imageUrl} alt={`Slide ${i+1}`} className="w-full aspect-[4/5] object-cover" />
                            </div>
                          )}
                          <div className="flex items-start gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-pink-100 dark:bg-pink-900/50 text-pink-600 text-[10px] font-bold shrink-0">
                              {i + 1}
                            </span>
                            <div className="space-y-1 pr-8">
                              <h4 className="text-xs font-bold text-pink-700 dark:text-pink-400 flex items-center gap-1.5">
                                {slide.emoji} {slide.headline}
                              </h4>
                              <p className="text-[11px] text-muted-foreground leading-snug">
                                {slide.body}
                              </p>
                            </div>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => copyToClipboard(`${slide.headline}\n${slide.body}`, `carousel-${i}`)}
                            >
                              {copiedStates[`carousel-${i}`] ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* WhatsApp Card */}
            <Card className="overflow-hidden border-green-100 dark:border-green-900 shadow-sm">
              <CardHeader className="bg-green-50/50 dark:bg-green-900/10 pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="p-1.5 bg-green-500 rounded-lg text-white">
                      <MessageCircle className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-sm font-bold">WhatsApp</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-green-600"
                      onClick={() => {
                        window.open(`https://wa.me/?text=${encodeURIComponent(generatedContent.whatsapp)}`, '_blank');
                        toast.success("Opening WhatsApp...");
                      }}
                    >
                      <Share2 className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={() => copyToClipboard(generatedContent.whatsapp, 'whatsapp')}
                    >
                      {copiedStates['whatsapp'] ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="p-3 bg-muted/40 rounded-lg text-sm border-l-2 border-green-500">
                   {generatedContent.whatsapp}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
