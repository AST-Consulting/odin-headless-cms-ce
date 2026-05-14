import { KpiMetric, Article, Topic, SeoHealth } from "./types";
import { BEATS, ARTICLE_STATUSES } from "./constants";

// Mock Data
export const mockKpiMetrics: KpiMetric[] = [
  { title: "Published Articles", value: "1,204", delta: "+5.2%", trend: "up" },
  { title: "Avg. Pageviews / Article", value: "2,845", delta: "-1.8%", trend: "down" },
  { title: "Avg. Time on Page", value: "3:45", delta: "+12.1%", trend: "up" },
  { title: "Avg. SEO Score", value: "88/100", delta: "+2.0", trend: "up" },
];

export const mockTopics: Topic[] = [
    { topic: 'AI assistants replacing junior developers?', score: 9.2, lang: 'EN', freshness: 'New' },
    { topic: 'The rise of serverless GPUs for AI inference', score: 8.8, lang: 'EN', freshness: 'Rising' },
    { topic: 'WebAssembly for frontend: A new era?', score: 8.5, lang: 'EN', freshness: 'Rising' },
    { topic: 'Quantum computing\'s threat to modern encryption', score: 9.5, lang: 'EN', freshness: 'Hot' },
    { topic: 'The ethics of AI-generated art and copyright law', score: 8.2, lang: 'EN', freshness: 'New' },
    { topic: 'Decentralized social media: The future of online communities', score: 7.9, lang: 'EN', freshness: 'New' },
    { topic: 'Low-code vs. Pro-code: The battle for enterprise development', score: 8.9, lang: 'EN', freshness: 'Hot' },
    { topic: 'The impact of 5G on IoT device connectivity and speed', score: 8.7, lang: 'EN', freshness: 'Rising' },
];

export const mockArticles: Article[] = [
    {
      _id: '1', title: 'Getting Started with Next.js 14', status: 'draft', authors: [{ id: '1', name: 'Alice' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '2', title: 'The Ultimate Guide to Tailwind CSS', status: 'draft', authors: [{ id: '2', name: 'Bob' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '3', title: 'AI in 2024: A Look Ahead', status: 'review', authors: [{ id: '3', name: 'Charlie' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '4', title: 'Mastering TypeScript for Large-Scale Apps', status: 'review', authors: [{ id: '1', name: 'Alice' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '5', title: 'State Management in React: Zustand vs. Redux', status: 'scheduled', authors: [{ id: '4', name: 'David' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '6', title: 'Deploying a NestJS API with Docker', status: 'scheduled', authors: [{ id: '5', name: 'Eve' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '7', title: 'A Deep Dive into Server Components', status: 'published', authors: [{ id: '6', name: 'Frank' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '8', title: 'Advanced SEO Techniques for 2024', status: 'published', authors: [{ id: '7', name: 'Grace' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
    {
      _id: '9', title: 'Building a Design System with shadcn/ui', status: 'published', authors: [{ id: '8', name: 'Heidi' }], lang: 'en',
      type: "",
      user: {
        id: "",
        name: ""
      },
      organizationId: "",
      propertyId: "",
      createdAt: "",
      updatedAt: ""
    },
];

export const mockSeoHealth: SeoHealth[] = [
    { article: "Getting Started with Next.js 14", largeImage: true, schema: "ok", byline: true, freshness: "2 days ago", score: 95 },
    { article: "The Ultimate Guide to Tailwind CSS", largeImage: true, schema: "ok", byline: true, freshness: "1 week ago", score: 92 },
    { article: "AI in 2024: A Look Ahead", largeImage: false, schema: "warn", byline: true, freshness: "3 days ago", score: 78 },
    { article: "Mastering TypeScript for Large-Scale Apps", largeImage: true, schema: "error", byline: false, freshness: "5 days ago", score: 65 },
    { article: "State Management in React", largeImage: true, schema: "ok", byline: true, freshness: "1 day ago", score: 88 },
    { article: "Deploying a NestJS API with Docker", largeImage: false, schema: "warn", byline: true, freshness: "4 days ago", score: 72 },
];

export const mockDeskReport = [
  { desk: "Tech", numberOfStories: 5, totalPageviews: 15234 },
  { desk: "Business", numberOfStories: 3, totalPageviews: 9876 },
  { desk: "Security", numberOfStories: 2, totalPageviews: 7543 },
];
export const mockCategoryReport = [
  { category: "AI", numberOfStories: 4, totalPageviews: 12876 },
  { category: "Web Dev", numberOfStories: 3, totalPageviews: 11987 },
  { category: "Cloud", numberOfStories: 3, totalPageviews: 7890 },
];
