import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Block, Property, Organization, AuthorStub, FactCheckResult, FeaturedMedia, RecipeMetadata, MovieReviewMetadata } from "./types";
import type { WebStoryData, StorySlide, StoryElement } from "./web-story.types";
import type { ArticleStats } from "./article-stats";
import { getProperties, getOrganizations } from "./api";


interface ThemeState {
  theme: "light" | "dark";
  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: "light",
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((state) => ({ theme: state.theme === "light" ? "dark" : "light" })),
    }),
    {
      name: "theme-storage",
    }
  )
);

interface SeoMetadata {
  title: string;
  description: string;
}

export interface ImageAsset {
  id?: string;
  url: string;
  path?: string;
  alt?: string;
  caption?: string;
  credit?: string;
  width?: number;
  height?: number;
  mimeType?: string;
  sizes?: any;
}

interface EditorState {
  blocks: Block[];
  selectedBlockId: string | null;
  seoData: SeoMetadata | null;
  tags: string[];
  categories: string[];
  setBlocks: (blocks: Block[]) => void;
  addBlock: (block: Block) => void;
  updateBlock: (id: string, content: any) => void;
  deleteBlock: (id: string) => void;
  setSelectedBlock: (id: string | null) => void;
  reorderBlocks: (fromIndex: number, toIndex: number) => void;
  moveBlock: (activeId: string, overId: string) => void;
  setSeoData: (seoData: SeoMetadata | null) => void;
  setTags: (tags: string[]) => void;
  setCategories: (categories: string[]) => void;
  primaryCategory: string | null;
  primaryCategorySlug: string | null;
  setPrimaryCategory: (category: string | null) => void;
  setPrimaryCategorySlug: (slug: string | null) => void;
  authors: AuthorStub[];
  setAuthors: (authors: AuthorStub[]) => void;
  articleTitle: string;
  // Derived from editor.document by BlockNoteEditor's debounced runSync.
  // Consumed by the editor's footer strip and the SEO tab.
  articleStats: ArticleStats;
  setArticleStats: (stats: ArticleStats) => void;
  currentArticleId: string | null;
  articleUpdatedAt: string | null;
  slug: string;
  status: string;
  scheduledAt: string;
  setScheduledAt: (scheduledAt: string) => void;
  coverageStartTime: string;
  coverageEndTime: string;
  setCoverageStartTime: (time: string) => void;
  setCoverageEndTime: (time: string) => void;
  isSponsored: boolean;
  isPremium: boolean;
  setIsSponsored: (value: boolean) => void;
  setIsPremium: (value: boolean) => void;
  images: ImageAsset[];
  englishHeadline: string;
  isManualSlug: boolean;
  slugStatus: 'available' | 'taken' | null;
  setEnglishHeadline: (title: string) => void;
  setIsManualSlug: (isManual: boolean) => void;
  setSlugStatus: (status: 'available' | 'taken' | null) => void;
  setArticleTitle: (title: string) => void;
  setCurrentArticleId: (id: string | null) => void;
  setArticleUpdatedAt: (date: string | null) => void;
  setSlug: (slug: string) => void;
  setStatus: (status: string) => void;
  setImages: (images: ImageAsset[]) => void;
  resetEditor: () => void;
  articleType: string;
  setArticleType: (type: string) => void;
  featuredVideo: FeaturedMedia | null;
  setFeaturedVideo: (video: FeaturedMedia | null) => void;
  recipeData: RecipeMetadata | null;
  setRecipeData: (data: RecipeMetadata | null) => void;
  movieReviewData: MovieReviewMetadata | null;
  setMovieReviewData: (data: MovieReviewMetadata | null) => void;
  generationJobId: string | null;
  setGenerationJobId: (jobId: string | null) => void;
  // Web Story specific state
  webStoryData: WebStoryData | null;
  activeSlideId: string | null;
  selectedElementId: string | null;
  setWebStoryData: (data: WebStoryData | null) => void;
  setActiveSlideId: (id: string | null) => void;
  setSelectedElementId: (id: string | null) => void;
  webStoryTemplates: any[];
  setWebStoryTemplates: (templates: any[]) => void;
  addSlide: (slide: StorySlide) => void;
  updateSlide: (id: string, updates: Partial<StorySlide>) => void;
  deleteSlide: (id: string) => void;
  addElement: (slideId: string, element: StoryElement) => void;
  updateElement: (slideId: string, elementId: string, updates: Partial<StoryElement>) => void;
  deleteElement: (slideId: string, elementId: string) => void;
  reorderSlides: (fromIndex: number, toIndex: number) => void;
  reorderElements: (slideId: string, fromIndex: number, toIndex: number) => void;
  duplicateSlide: (id: string) => void;
  webStoryPickTarget: "element" | "background";
  setWebStoryPickTarget: (target: "element" | "background") => void;
  factCheckJobId: string | null;
  setFactCheckJobId: (jobId: string | null) => void;
  factCheckResult: FactCheckResult | null;
  setFactCheckResult: (result: FactCheckResult | null) => void;
}

// Hydration state tracking
let editorStoreHydrated = false;
const editorHydrationCallbacks: (() => void)[] = [];

export const waitForEditorHydration = (): Promise<void> => {
  if (editorStoreHydrated) return Promise.resolve();
  return new Promise((resolve) => {
    editorHydrationCallbacks.push(resolve);
  });
};

export const useEditorStore = create<EditorState>()(
  persist(
    (set) => ({
      blocks: [],
      selectedBlockId: null,
      seoData: null,
      tags: [],
      categories: [],
      authors: [],
      articleTitle: "",
      articleStats: { words: 0, readingMinutes: 0 },
      currentArticleId: null,
      articleUpdatedAt: null,
      slug: "",
      status: "draft",
      scheduledAt: "",
      coverageStartTime: "",
      coverageEndTime: "",
      isSponsored: false,
      isPremium: false,
      images: [],
      englishHeadline: "",
      isManualSlug: false,
      slugStatus: null,
      articleType: "article",
      generationJobId: null,
      webStoryData: null,
      activeSlideId: null,
      selectedElementId: null,
      recipeData: null,
      movieReviewData: null,
      setWebStoryData: (data) => set({ webStoryData: data }),
      setActiveSlideId: (id) => set({ activeSlideId: id }),
      setSelectedElementId: (id) => set({ selectedElementId: id }),
      webStoryTemplates: [],
      setWebStoryTemplates: (templates) => set({ webStoryTemplates: templates }),
      addSlide: (slide) => set((state) => ({
        webStoryData: {
          ...state.webStoryData!,
          slides: [...(state.webStoryData?.slides || []), slide]
        }
      })),
      updateSlide: (id, updates) => set((state) => ({
        webStoryData: {
          ...state.webStoryData!,
          slides: state.webStoryData!.slides.map(s => s.id === id ? { ...s, ...updates } : s)
        }
      })),
      addElement: (slideId, element) => set((state) => ({
        webStoryData: {
          ...state.webStoryData!,
          slides: state.webStoryData!.slides.map(s => s.id === slideId ? { ...s, elements: [...s.elements, element] } : s)
        }
      })),
      updateElement: (slideId, elementId, updates) => set((state) => ({
        webStoryData: {
          ...state.webStoryData!,
          slides: state.webStoryData!.slides.map(s => s.id === slideId ? {
            ...s,
            elements: s.elements.map(el => el.id === elementId ? { ...el, ...updates } : el)
          } : s)
        }
      })),
      deleteElement: (slideId, elementId) => set((state) => ({
        webStoryData: {
          ...state.webStoryData!,
          slides: state.webStoryData!.slides.map(s => s.id === slideId ? {
            ...s,
            elements: s.elements.filter(el => el.id !== elementId)
          } : s)
        }
      })),
      reorderSlides: (fromIndex, toIndex) => set((state) => {
        if (!state.webStoryData) return state;
        const slides = [...state.webStoryData.slides];
        const [moved] = slides.splice(fromIndex, 1);
        slides.splice(toIndex, 0, moved);
        return { webStoryData: { ...state.webStoryData, slides } };
      }),
      reorderElements: (slideId, fromIndex, toIndex) => set((state) => {
        if (!state.webStoryData) return state;
        return {
          webStoryData: {
            ...state.webStoryData,
            slides: state.webStoryData.slides.map(s => {
              if (s.id !== slideId) return s;
              const elements = [...s.elements];
              const [moved] = elements.splice(fromIndex, 1);
              elements.splice(toIndex, 0, moved);
              return { ...s, elements };
            })
          }
        };
      }),
      duplicateSlide: (id) => set((state) => {
        if (!state.webStoryData) return state;
        const slide = state.webStoryData.slides.find(s => s.id === id);
        if (!slide) return state;

        // Deep copy slide with new IDs
        const newSlide = {
          ...slide,
          id: crypto.randomUUID(),
          elements: slide.elements.map(el => ({
            ...el,
            id: crypto.randomUUID(),
            style: { ...el.style },
            animation: { ...el.animation }
          }))
        };

        const index = state.webStoryData.slides.findIndex(s => s.id === id);
        const slides = [...state.webStoryData.slides];
        slides.splice(index + 1, 0, newSlide);
        return { webStoryData: { ...state.webStoryData, slides } };
      }),
      deleteSlide: (id) => set((state) => {
        if (!state.webStoryData || state.webStoryData.slides.length <= 1) return state;
        const slides = state.webStoryData.slides.filter(s => s.id !== id);
        let activeId = state.activeSlideId;
        if (activeId === id) {
          activeId = slides[0].id;
        }
        return {
          webStoryData: { ...state.webStoryData, slides },
          activeSlideId: activeId
        };
      }),
      webStoryPickTarget: "element",
      setWebStoryPickTarget: (target) => set({ webStoryPickTarget: target }),
      factCheckJobId: null,
      setFactCheckJobId: (jobId) => set({ factCheckJobId: jobId }),
      factCheckResult: null,
      setFactCheckResult: (result) => set({ factCheckResult: result }),
      setGenerationJobId: (jobId) => set({ generationJobId: jobId }),
      setEnglishHeadline: (englishHeadline) => set({ englishHeadline }),
      setIsManualSlug: (isManualSlug) => set({ isManualSlug }),
      setSlugStatus: (slugStatus) => set({ slugStatus }),
      setArticleType: (type) => set({ articleType: type }),
      featuredVideo: null,
      setFeaturedVideo: (featuredVideo) => set({ featuredVideo }),
      setRecipeData: (recipeData) => set({ recipeData }),
      setMovieReviewData: (movieReviewData) => set({ movieReviewData }),
      setArticleTitle: (title) => set({ articleTitle: title }),
      setArticleStats: (stats) => set({ articleStats: stats }),
      setCurrentArticleId: (id) => set({ currentArticleId: id }),
      setArticleUpdatedAt: (date) => set({ articleUpdatedAt: date }),
      setSlug: (slug) => set({ slug }),
      setStatus: (status) => set({ status }),
      setScheduledAt: (scheduledAt) => set({ scheduledAt }),
      setCoverageStartTime: (coverageStartTime) => set({ coverageStartTime }),
      setCoverageEndTime: (coverageEndTime) => set({ coverageEndTime }),
      setIsSponsored: (isSponsored) => set({ isSponsored }),
      setIsPremium: (isPremium) => set({ isPremium }),
      setImages: (images) => set({ images }),
      resetEditor: () => set((state) => ({
        blocks: [],
        selectedBlockId: null,
        seoData: null,
        tags: [],
        categories: [],
        primaryCategory: null,
        primaryCategorySlug: null,
        authors: [],
        articleTitle: "",
        articleStats: { words: 0, readingMinutes: 0 },
        currentArticleId: null,
        articleUpdatedAt: null,
        slug: "",
        status: "draft",
        scheduledAt: "",
        coverageStartTime: "",
        coverageEndTime: "",
        isSponsored: false,
        isPremium: false,
        images: [],
        englishHeadline: "",
        isManualSlug: false,
        slugStatus: null,
        articleType: "article",
        featuredVideo: null,
        webStoryData: null,
        activeSlideId: null,
        selectedElementId: null,
        recipeData: null,
        movieReviewData: null,
        // Preserve generationJobId — active generation must survive page navigation
        generationJobId: state.generationJobId,
        factCheckJobId: null,
        factCheckResult: null,
      })),
      setBlocks: (blocks) => set({ blocks }),
      addBlock: (block) => set((state) => ({ blocks: [...state.blocks, block] })),
      updateBlock: (id, content) =>
        set((state) => ({
          blocks: state.blocks.map((b) => (b.id === id ? { ...b, content } : b)),
        })),
      deleteBlock: (id) => set((state) => ({ blocks: state.blocks.filter((b) => b.id !== id) })),
      setSelectedBlock: (id) => set({ selectedBlockId: id }),
      reorderBlocks: (fromIndex, toIndex) =>
        set((state) => {
          const blocks = [...state.blocks];
          const [moved] = blocks.splice(fromIndex, 1);
          blocks.splice(toIndex, 0, moved);
          return { blocks: blocks.map((b, i) => ({ ...b, order: i })) };
        }),
      moveBlock: (activeId, overId) =>
        set((state) => {
          const oldIndex = state.blocks.findIndex((block) => block.id === activeId);
          const newIndex = state.blocks.findIndex((block) => block.id === overId);

          if (oldIndex === -1 || newIndex === -1) return state;

          const blocks = [...state.blocks];
          const [moved] = blocks.splice(oldIndex, 1);
          blocks.splice(newIndex, 0, moved);
          return { blocks: blocks.map((b, i) => ({ ...b, order: i })) };
        }),
      setSeoData: (seoData) => set({ seoData }),
      setTags: (tags) => set({ tags }),
      setCategories: (categories) => set({ categories }),
      primaryCategory: null,
      primaryCategorySlug: null,
      setPrimaryCategory: (category) => set({ primaryCategory: category }),
      setPrimaryCategorySlug: (slug) => set({ primaryCategorySlug: slug }),
      setAuthors: (authors) => set({ authors }),
    }),
    {
      name: "editor-storage",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => () => {
        editorStoreHydrated = true;
        const callbacks = editorHydrationCallbacks.slice();
        editorHydrationCallbacks.splice(0, editorHydrationCallbacks.length);
        callbacks.forEach(cb => cb());
      },
    }
  )
);

interface AnalyticsFilters {
  dateRange: { from: Date; to: Date } | null;
  beat: string | null;
  channel: string | null;
  author: string | null;
  setDateRange: (range: { from: Date; to: Date } | null) => void;
  setBeat: (beat: string | null) => void;
  setChannel: (channel: string | null) => void;
  setAuthor: (author: string | null) => void;
  reset: () => void;
}

export const useAnalyticsStore = create<AnalyticsFilters>()((set) => ({
  dateRange: null,
  beat: null,
  channel: null,
  author: null,
  setDateRange: (dateRange) => set({ dateRange }),
  setBeat: (beat) => set({ beat }),
  setChannel: (channel) => set({ channel }),
  setAuthor: (author) => set({ author }),
  reset: () => set({ dateRange: null, beat: null, channel: null, author: null }),
}));

export interface DashboardFactCheckEntry {
  jobId: string | null;
  status: "idle" | "processing" | "completed" | "failed";
  result: FactCheckResult | null;
  error: string | null;
  lastCheckedAt: string | null;
}

interface DashboardFactCheckState {
  entries: Record<string, DashboardFactCheckEntry>;
  queueCheck: (articleId: string) => void;
  startCheck: (articleId: string, jobId: string) => void;
  completeCheck: (articleId: string, result: FactCheckResult | null) => void;
  failCheck: (articleId: string, error: string) => void;
  clearCheck: (articleId: string) => void;
}

export const useDashboardFactCheckStore = create<DashboardFactCheckState>()((set) => ({
  entries: {},
  queueCheck: (articleId) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [articleId]: {
          jobId: null,
          status: "processing",
          result: state.entries[articleId]?.result || null,
          error: null,
          lastCheckedAt: state.entries[articleId]?.lastCheckedAt || null,
        },
      },
    })),
  startCheck: (articleId, jobId) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [articleId]: {
          jobId,
          status: "processing",
          result: null,
          error: null,
          lastCheckedAt: state.entries[articleId]?.lastCheckedAt || null,
        },
      },
    })),
  completeCheck: (articleId, result) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [articleId]: {
          jobId: null,
          status: "completed",
          result,
          error: null,
          lastCheckedAt: new Date().toISOString(),
        },
      },
    })),
  failCheck: (articleId, error) =>
    set((state) => ({
      entries: {
        ...state.entries,
        [articleId]: {
          jobId: null,
          status: "failed",
          result: state.entries[articleId]?.result || null,
          error,
          lastCheckedAt: new Date().toISOString(),
        },
      },
    })),
  clearCheck: (articleId) =>
    set((state) => {
      const nextEntries = { ...state.entries };
      delete nextEntries[articleId];
      return { entries: nextEntries };
    }),
}));



interface OrganizationState {
  selectedOrganization: Organization | null;
  organizations: Organization[];
  isFetching: boolean;
  setSelectedOrganization: (org: Organization | null) => void;
  fetchOrganizations: () => Promise<void>;
}

export const useOrganizationStore = create<OrganizationState>()(
  persist(
    (set, get) => ({
      selectedOrganization: null,
      organizations: [],
      isFetching: false,
      setSelectedOrganization: async (org) => {
        const currentOrg = get().selectedOrganization;
        // Only trigger update logic if the organization actually changed
        if (org?._id === currentOrg?._id && currentOrg !== null) return;

        set({ selectedOrganization: org });

        // Refresh permissions for the newly selected organization context
        if (org?._id) {
          try {
            const { getContextPermissions } = await import("./api");
            const { roles, permissions } = await getContextPermissions(org._id);
            const { useAuthStore } = await import("./auth");
            useAuthStore.getState().setContext(roles, permissions);
          } catch (error) {
            console.error("Failed to refresh context permissions:", error);
          }
        }

        // Logic for re-fetching properties only when organization changes
        // and we are NOT in the middle of a manual dual-selection (like in UnifiedSelector)
        // We use a small delay or check if the property was recently set
        const propertyStore = usePropertyStore.getState();
        if (propertyStore.selectedProperty?.organizationId !== org?._id) {
          propertyStore.setSelectedProperty(null);
          propertyStore.fetchProperty();
        }
      },
      fetchOrganizations: async () => {
        if (get().isFetching) return;
        set({ isFetching: true });
        try {
          const res = await getOrganizations();
          const orgs = res.data || [];

          const currentSelected = get().selectedOrganization;
          // Look for the currently selected org by ID in the new response
          const stableSelection = currentSelected ? orgs.find((o: Organization) => (o._id || o.id) === (currentSelected._id || currentSelected.id)) : null;

          const nextSelected = stableSelection || currentSelected || orgs[0] || null;

          set({
            organizations: orgs,
            isFetching: false,
            selectedOrganization: nextSelected
          });

          // If we auto-selected an organization, fetch its permissions AND properties
          if (nextSelected?._id && !currentSelected) {
            const { getContextPermissions } = await import("./api");
            const { roles, permissions } = await getContextPermissions(nextSelected._id);
            const { useAuthStore } = await import("./auth");
            useAuthStore.getState().setContext(roles, permissions);

            // Also fetch properties for this new organization
            usePropertyStore.getState().fetchProperty();
          }
        } catch (error) {
          console.error("Failed to fetch organizations:", error);
          set({ isFetching: false });
        }
      }
    }),
    {
      name: 'organization-storage',
    }
  )
);

interface PropertyState {
  selectedProperty: Property | null;
  lastFetched: number;
  isFetching: boolean;
  setSelectedProperty: (property: Property | null) => void;
  fetchProperty: () => Promise<void>;
}

export const usePropertyStore = create<PropertyState>()(
  persist(
    (set, get) => ({
      selectedProperty: null,
      lastFetched: 0,
      isFetching: false,
      setSelectedProperty: (property) => set({ selectedProperty: property, lastFetched: Date.now() }),
      fetchProperty: async () => {
        const { selectedProperty, lastFetched, isFetching } = get();
        const selectedOrg = useOrganizationStore.getState().selectedOrganization;

        const oneDay = 24 * 60 * 60 * 1000;

        // Prevent concurrent fetches
        if (isFetching) {
          return;
        }

        // If we have a property and it's fresh, don't refetch
        if (selectedProperty && (Date.now() - lastFetched < oneDay)) {
          return;
        }

        set({ isFetching: true });

        try {
          // Add organizational filter if it was selected in the UI
          const properties = await getProperties(selectedOrg?._id);
          if (properties && properties.length > 0) {
            set({
              selectedProperty: get().selectedProperty || properties[0],
              lastFetched: Date.now(),
              isFetching: false
            });
          } else {
            set({ selectedProperty: null, isFetching: false });
          }
        } catch (error) {
          console.error("Failed to fetch properties:", error);
          set({ isFetching: false });
        }
      },
    }),
    {
      name: 'property-storage',
      partialize: (state) => ({
        selectedProperty: state.selectedProperty,
        lastFetched: state.lastFetched
      }),
    }
  )
);

// ─── Video generator settings — persisted per property ───────────────────────
interface VideoGeneratorState {
  /** base64 dataUrl of the custom logo, keyed by propertyId. */
  logoByProperty: Record<string, string>;
  setLogo: (propertyId: string, dataUrl: string) => void;
  removeLogo: (propertyId: string) => void;
  getLogo: (propertyId: string) => string | null;
}

export const useVideoGeneratorStore = create<VideoGeneratorState>()(
  persist(
    (set, get) => ({
      logoByProperty: {},
      setLogo: (propertyId, dataUrl) =>
        set((s) => ({ logoByProperty: { ...s.logoByProperty, [propertyId]: dataUrl } })),
      removeLogo: (propertyId) =>
        set((s) => {
          const next = { ...s.logoByProperty };
          delete next[propertyId];
          return { logoByProperty: next };
        }),
      getLogo: (propertyId) => get().logoByProperty[propertyId] ?? null,
    }),
    {
      name: "video-generator-settings",
      storage: createJSONStorage(() => localStorage),
    }
  )
);

// ─── Layout store — sidebar ↔ AI assistant mutual exclusion at tight viewports ───
interface LayoutState {
  sidebarCollapsed: boolean;
  assistantCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setAssistantCollapsed: (collapsed: boolean) => void;
  /** Expand sidebar — auto-collapses AI assistant at tight widths */
  expandSidebar: () => void;
  /** Expand AI assistant — auto-collapses sidebar at tight widths */
  expandAssistant: () => void;
}

const isTightViewport = () => typeof window !== "undefined" && window.innerWidth < 1280;

export const useLayoutStore = create<LayoutState>()((set) => ({
  sidebarCollapsed: false,
  assistantCollapsed: isTightViewport(),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  setAssistantCollapsed: (collapsed) => set({ assistantCollapsed: collapsed }),
  expandSidebar: () => set((s) => ({
    sidebarCollapsed: false,
    assistantCollapsed: isTightViewport() ? true : s.assistantCollapsed,
  })),
  expandAssistant: () => set((s) => ({
    assistantCollapsed: false,
    sidebarCollapsed: isTightViewport() ? true : s.sidebarCollapsed,
  })),
}));
