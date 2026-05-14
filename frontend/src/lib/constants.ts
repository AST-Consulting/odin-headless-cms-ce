import {
    LayoutDashboard,
    Lightbulb,
    FileText,
    ShieldCheck,
    Workflow,
    BarChart2,
    Settings,
    LucideIcon
  } from "lucide-react";
  
  type NavLink = {
    href: string;
    label: string;
    icon: LucideIcon;
  };
  
  export const NAV_LINKS: NavLink[] = [
    {
      href: "/",
      label: "Dashboard",
      icon: LayoutDashboard,
    },
    {
      href: "/ideas",
      label: "Ideas & Trends",
      icon: Lightbulb,
    },
    {
      href: "/editor",
      label: "Editor",
      icon: FileText,
    },
    {
      href: "/seo",
      label: "SEO & Discover",
      icon: ShieldCheck,
    },
    {
      href: "/workflow",
      label: "Workflow",
      icon: Workflow,
    },
    {
      href: "/analytics",
      label: "Analytics",
      icon: BarChart2,
    },
    {
      href: "/account",
      label: "Account",
      icon: Settings,
    },
  ];
  
  export const BEATS = [
    { value: "local", label: "Local News" },
    { value: "sports", label: "Sports" },
    { value: "politics", label: "Politics" },
    { value: "business", label: "Business" },
  ];
  
  export const LANGUAGES = [
    // Common languages (shown first)
    { value: "en", label: "English", native: "English" },
    { value: "hi", label: "Hindi", native: "हिन्दी" },
    // Additional Indian languages
    { value: "bn", label: "Bengali", native: "বাংলা" },
    { value: "gu", label: "Gujarati", native: "ગુજરાતી" },
    { value: "kn", label: "Kannada", native: "ಕನ್ನಡ" },
    { value: "ml", label: "Malayalam", native: "മലയാളം" },
    { value: "mr", label: "Marathi", native: "मराठी" },
    { value: "or", label: "Odia", native: "ଓଡ଼ିଆ" },
    { value: "pa", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
    { value: "ta", label: "Tamil", native: "தமிழ்" },
    { value: "te", label: "Telugu", native: "తెలుగు" },
    { value: "ur", label: "Urdu", native: "اردو" },
  ];

  // Helper to get language name by code
  export const getLanguageName = (code: string): string => {
    const lang = LANGUAGES.find(l => l.value === code);
    return lang?.native || lang?.label || 'English';
  };
  
  export const ARTICLE_STATUSES = [
    { value: "draft", label: "Draft" },
    { value: "review", label: "In Review" },
    { value: "legal", label: "Legal Check" },
    { value: "scheduled", label: "Scheduled" },
    { value: "published", label: "Published" },
  ];
  
export const PRODUCT_NAME = "Odin CMS";
  
  // Role Management Constants
  // These must match the backend permission modules in permissions.config.ts
  export const MODULE_NAMES = {
    // Admin & Auth
    ADMINS: 'Admins',
    INVITATION: 'Invitation',
    ORGANIZATIONS: 'Organizations',
    ROLE: 'Role',
    USERS: 'Users',
    AUTH: 'Auth',

    // Content
    POLL: 'Poll',
    ARTICLES: 'Articles',
    CATEGORY: 'Category',
    TAGS: 'Tags',
    TESTIMONIALS: 'Testimonials',
    WEBSTORY_TEMPLATE: 'Web Story Template',
    REPURPOSE: 'Repurpose',

    // CMS
    FAQ: 'FAQ',
    MENU: 'Menu',
    PAGES: 'Pages',
    SECTION: 'Section',
    SLUGS: 'Slugs',

    // Display
    BANNER: 'Banner',
    BANNER_TYPE: 'Banner Type',
    PROPERTY: 'Property',

    // Tools & Utilities
    AI: 'AI',
    ANALYTICS: 'Analytics',
    AUDIT_TRAIL: 'Audit Trail',
    MEDIA: 'Media',

    // Data Builder
    CONTENT_BUILDER: 'Content Builder',
    CONTENT_MANAGER: 'Content Manager',
  } as const;

  export const MODULE_VALUES = {
    // Admin & Auth
    [MODULE_NAMES.ADMINS]: 'admins',
    [MODULE_NAMES.INVITATION]: 'invitation',
    [MODULE_NAMES.ORGANIZATIONS]: 'organizations',
    [MODULE_NAMES.ROLE]: 'role',
    [MODULE_NAMES.USERS]: 'users',
    [MODULE_NAMES.AUTH]: 'auth',

    // Content
    [MODULE_NAMES.POLL]: 'poll',
    [MODULE_NAMES.ARTICLES]: 'articles',
    [MODULE_NAMES.CATEGORY]: 'category',
    [MODULE_NAMES.TAGS]: 'tags',
    [MODULE_NAMES.TESTIMONIALS]: 'testimonials',
    [MODULE_NAMES.WEBSTORY_TEMPLATE]: 'webstory-template',
    [MODULE_NAMES.REPURPOSE]: 'repurpose',

    // CMS
    [MODULE_NAMES.FAQ]: 'faq',
    [MODULE_NAMES.MENU]: 'menu',
    [MODULE_NAMES.PAGES]: 'pages',
    [MODULE_NAMES.SECTION]: 'section',
    [MODULE_NAMES.SLUGS]: 'slugs',

    // Display
    [MODULE_NAMES.BANNER]: 'banner',
    [MODULE_NAMES.BANNER_TYPE]: 'banner-type',
    [MODULE_NAMES.PROPERTY]: 'property',

    // Tools & Utilities
    [MODULE_NAMES.AI]: 'ai',
    [MODULE_NAMES.ANALYTICS]: 'analytics',
    [MODULE_NAMES.AUDIT_TRAIL]: 'audit-trail',
    [MODULE_NAMES.MEDIA]: 'files',

    // Data Builder
    [MODULE_NAMES.CONTENT_BUILDER]: 'content-builder',
    [MODULE_NAMES.CONTENT_MANAGER]: 'content-manager',
  } as const;
  
  export const PERMISSION_ACTIONS = {
    READ: 'read',
    WRITE: 'write', 
    EDIT: 'edit',
    DELETE: 'delete'
  } as const;
  
  export const ROLE_STATUS = {
    ACTIVE: 'active',
    INACTIVE: 'inactive'
  } as const;
  
  export type ModuleName = keyof typeof MODULE_NAMES;
  export type ModuleValue = typeof MODULE_VALUES[keyof typeof MODULE_VALUES];
  export type PermissionAction = typeof PERMISSION_ACTIONS[keyof typeof PERMISSION_ACTIONS];
  export type RoleStatus = typeof ROLE_STATUS[keyof typeof ROLE_STATUS];
  

export const INDUSTRY = {
  INFORMATION_TECHNOLOGY: 'Information Technology',
  HEALTHCARE: 'Healthcare',
  FINANCE: 'Finance',
  EDUCATION_AND_TECHNOLOGY: 'Education and Technology',
  REAL_ESTATE: 'Real Estate',
  OTHER: 'Other',
  FASHION_AND_COMFORT: 'Fashion and Comfort',
  ARTIFICIAL_INTELLIGENCE: 'Artificial Intelligence',
  AGRICULTURE: 'Agriculture',
  AUTOMOTIVE_INDUSTRY: 'Automotive Industry',
  SEMICONDUCTORS: 'Semiconductors',
  NEWS: 'News',
};
