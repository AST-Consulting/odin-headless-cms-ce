export const STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  DELETED: 'deleted',
  TO_BE_DELETED: 'to_be_deleted',
  EXPIRED: 'expired',
  PENDING: 'pending',
  INVISIBLE: 'invisible',
  HALTED: 'halted',
  PAID: 'paid',
  PAUSED: 'paused',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
};
export const ContentTypeList = ['blogs', 'banners', 'sections', 'static_pages', 'events'];

export const BLOG_STATUS = {
  PUBLISHED: 'published',
  DRAFT: 'draft',
  DELETED: 'deleted',
  ARCHIVED: 'archived',
  SCHEDULED: 'scheduled',
};

export const BLOG_TEMPLATE = {
  STANDARD: 'standard',
  FEATURED: 'featured',
  MINIMAL: 'minimal',
  WIDE: 'wide',
  TEXT: 'text',
  VIDEO: 'video',
  AUDIO: 'audio',
  PHOTO_GALLERY: 'photo_gallery',
  LIVE: 'live',
};

export const FAQ_ENTITY_TYPE = {
  ARTICLE: 'article',
  BLOG: 'blog',
  PAGE: 'page',
  GENERAL: 'general',
};

export enum LANGUAGE {
  ENGLISH = 'english',
  HINDI = 'hindi',
}

export enum SCHEDULE_STATUS {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  PAUSED = 'paused',
}

export enum FREQUENCY_TYPE {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  CUSTOM = 'custom',
}

export enum CONTENT_TYPE {
  NEWS = 'news',
  ANALYSIS = 'analysis',
  EDUCATIONAL = 'educational',
  INTERVIEW = 'interview',
  OPINION = 'opinion',
  REVIEW = 'review',
  TUTORIAL = 'tutorial',
}

export enum SUBSCRIPTION_EVENT {
  SUBSCRIPTION_AUTHENTICATED = 'subscription.authenticated',
  SUBSCRIPTION_CHARGED = 'subscription.charged',
  SUBSCRIPTION_CANCELLED = 'subscription.cancelled',
  SUBSCRIPTION_COMPLETED = 'subscription.completed',
  SUBSCRIPTION_ACTIVATED = 'subscription.activated',
  SUBSCRIPTION_PAUSED = 'subscription.paused',
  SUBSCRIPTION_RESUMED = 'subscription.resumed',
  SUBSCRIPTION_PAYMENT_FAILED = 'subscription.payment_failed',
  SUBSCRIPTION_PAYMENT_RETRY = 'subscription.payment_retry',
  SUBSCRIPTION_PAYMENT_SUCCESS = 'subscription.payment_success',
  SUBSCRIPTION_PENDING = 'subscription.pending',
  SUBSCRIPTION_HALTED = 'subscription.halted',
}

export enum TARGET_TONE {
  PROFESSIONAL = 'Professional',
  FRIENDLY = 'Friendly',
  AUTHORITATIVE = 'Authoritative',
  ENTHUSIASTIC = 'Enthusiastic',
  HUMOROUS = 'Humorous',
  SERIOUS = 'Serious',
  INSPIRATIONAL = 'Inspirational',
  EDUCATIONAL = 'Educational',
  CASUAL = 'Casual',
  TECHNICAL = 'Technical',
  CREATIVE = 'Creative',
  PERSUASIVE = 'Persuasive',
  INFORMATIVE = 'Informative',
  ENTERTAINING = 'Entertaining',
}

export const POST_STATUS = {
  GENERATED: 'generated',
  POSTED: 'posted',
  DRAFT: 'draft',
  DELETED: 'deleted',
  ARCHIVED: 'archived',
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
};

export const PLATFORM = {
  WORDPRESS: 'wordpress',
  SHOPIFY: 'shopify',
  BLOGGER: 'blogger',
  TUMBLR: 'tumblr',
  MEDIUM: 'medium',
  GHOST: 'ghost',
  WIX: 'wix',
  SQUARESPACE: 'squarespace',
  WEBFLOW: 'webflow',
  JIMDO: 'jimdo',
  STRIKINGLY: 'strikingly',
  SITE123: 'site123',
  GOOGLE_SITES: 'google-sites',
  OTHER: 'other',
};

export const SITE_SLUG = {
  INTERNAL: 'internal',
  AI47LABS: 'ai47labs',
  FREECUTRE: 'freecultre',
  BIGUNIVERSITIES: 'biguniversities',
  STOCKSBABA: 'stocksbaba',
};

export const PUBLISH_STATUS = {
  DRAFT: 'draft',
  IMMEDIATE: 'immediate',
  SCHEDULED: 'scheduled',
};

export const CONTENT_FORMAT = {
  LISTICLE: 'Listicle',
  Q_AND_A: 'Q&A',
  HOW_TO_GUIDE: 'How to Guide',
  CHECKLIST: 'Checklist',
  ROADMAP: 'Roadmap',
  VERSUS_ARTICLE: 'Versus Article',
};

export const TARGET_AUDIENCE = {
  'Age 0-12': 'Children (0-12)',
  'Age 13-17': 'Teens (13-17)',
  'Age 18-24': 'Young Adults (18-24)',
  'Age 25-64': 'Adults (25-64)',
  'Age 65+': 'Seniors (65+)',
};

export enum CREDIT_COST {
  IMAGE_GENERATION = 3,
  POST_GENERATION = 1,
  SLIDES_GENERATION = 2,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  ARTICLE_GENERATION = 1,
  // eslint-disable-next-line @typescript-eslint/no-duplicate-enum-values
  COMMENT_GENERATION = 1,
}

export enum POST_TYPE {
  TEXT = 'text',
  SLIDES = 'slides',
  ARTICLE = 'article',
  IMAGE = 'image',
  COMMENT = 'comment',
  VIDEO = 'video',
}

export const WP_POST_STATUS = {
  DRAFT: 'draft',
  PUBLISH: 'publish',
  FUTURE: 'future',
};

export const ARTICLE_TYPE = {
  NEWS: 'news',
  BLOG: 'blog',
  ARTICLE: 'article',
  PRODUCT: 'product',
  CATEGORY: 'category',
  PAGE: 'page',
  PRESS_RELEASE: 'press_release',
  REPORT: 'report',
  INTERVIEW: 'interview',
  OPINION: 'opinion',
  VIDEO: 'video',
  SHORTS: 'shorts',
};

export const ENDPOINT = {
  PAGES: 'pages',
  POSTS: 'posts',
  CATEGORIES: 'categories',
  TAGS: 'tags',
  PRODUCTS: 'products',
};

export const PUBLISH_TYPE = {
  API: 'api',
  EMAIL: 'email',
  DRIVE: 'drive',
};

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

export const AUTH_TYPE = {
  SIGNUP: 'SIGNUP',
  LOGIN: 'LOGIN',
  FORGOT_PASSWORD: 'FORGOT_PASSWORD',
  RESET_PASSWORD: 'RESET_PASSWORD',
  VERIFY_EMAIL: 'VERIFY_EMAIL',
};

export const CARD_ELEMENT_TYPE = {
  EMBEDJS: 'embedjs',
  TITLE: 'title',
  TEXT: 'text',
  IMAGE: 'image',
  VIDEO: 'video',
};

export const CARD_ELEMENT_SUBTYPE = {
  YOUTUBE: 'youtube',
  VIMEO: 'vimeo',
  TWITTER: 'twitter',
  INSTAGRAM: 'instagram',
  FACEBOOK: 'facebook',
  LINKEDIN: 'linkedin',
  TIKTOK: 'tiktok',
  PINTEREST: 'pinterest',
  SNAPCHAT: 'snapchat',
  TUMBLR: 'tumblr',
  REDDIT: 'reddit',
  QUORA: 'quora',
  MEDIUM: 'medium',
  GITHUB: 'github',
  STACKOVERFLOW: 'stackoverflow',
  VIMEO_VIDEO: 'vimeo_video',
  YOUTUBE_VIDEO: 'youtube_video',
  SOUNDCLOUD_AUDIO: 'soundcloud_audio',
  SPOTIFY_AUDIO: 'spotify_audio',
  TWITTER_TWEET: 'twitter_tweet',
  INSTAGRAM_POST: 'instagram_post',
  FACEBOOK_POST: 'facebook_post',
  LINKEDIN_POST: 'linkedin_post',
  TIKTOK_POST: 'tiktok_post',
  PINTEREST_PIN: 'pinterest_pin',
  SNAPCHAT_SNAP: 'snapchat_snap',
  REDDIT_POST: 'reddit_post',
  QUORA_POST: 'quora_post',
  MEDIUM_POST: 'medium_post',
};

export enum PRIORITY {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
}

export const SUCCESS_STATUS = {
  SUCCESS: 'success',
  FAIL: 'failed',
};

export const FILE_UPLOAD_SERVICE = {
  S3: 'S3',
  LOCAL: 'LOCAL',
  CLOUDINARY: 'CLOUDINARY',
};

export const FILE_UPLOAD_STRATEGY = {
  CHUNKS: 'CHUNKS',
  FULL: 'FULL',
};
export const FILE_PATH_TYPE = {
  PUBLIC: 'public',
  PRIVATE: 'private',
};

export const DEFAULT_ROLE = ['DEFAULT'];

export enum UserType {
  ADMIN = 'admin',
  USER = 'user',
  AUTHOR = 'author',
}

export enum GENDER {
  MALE = 'male',
  FEMALE = 'female',
  OTHERS = 'others',
}

export enum MaritalStatus {
  SINGLE = 'single',
  MARRIED = 'married',
}

export enum RelationType {
  FATHER = 'father',
  MOTHER = 'mother',
  PARENT = 'parent',
  SPOUSE = 'spouse',
  SIBLING = 'sibling',
  FRIEND = 'friend',
  DAUGHTER = 'daughter',
  SON = 'son',
  CHILD = 'child',
  GRANDPARENT = 'grandparent',
  GRANDCHILD = 'grandchild',
  UNCLE = 'uncle',
  AUNT = 'aunt',
  COUSIN = 'cousin',
  NEPHEW = 'nephew',
  NIECE = 'niece',
  IN_LAW = 'in-law',
  GUARDIAN = 'guardian',
  COLLEAGUE = 'colleague',
  STUDENT = 'student',
  NEIGHBOR = 'neighbor',
  OTHER = 'other',
}

export enum Frequency {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
  ONE_TIME = 'one-time',
}
export enum SubscriptionType {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
}
export enum PAYMENT_TYPE {
  RECURRING = 'recurring',
  ONE_TIME = 'one_time',
}
export enum ORDER_STATUS {
  NEW = 'new',
  PENDING = 'pending',
  COMPLETED = 'completed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
  PLACED = 'placed',
}
export enum CounterName {
  FORM = 'FormCounter',
  POLL = 'PollCounter',
  COUPON = 'CouponCounter',
  USER = 'UserCounter',
  ORDER = 'OrderCounter',
  SERVICE = 'ServiceCounter',
}
export enum PaymentStatus {
  PENDING = 'pending',
  PAID = 'paid',
  REFUNDED = 'refunded',
  FAILED = 'failed',
}
export enum PackageType {
  BASIC = 'basic',
  STANDARD = 'standard',
  PREMIUM = 'premium',
  DELUXE = 'deluxe',
}

export const PAGINATION = {
  OFFSET: 'offset',
  PAGE: 'page',
  NO_PAGINATION: 'no-pagination',
  DEFAULT_LIMIT: 15,
  DEFAULT_PAGE: 1,
};

export enum ACTIONS {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  MARK_FOR_DELETION = 'mark_for_deletion',
  VIEW = 'view',
  DOWNLOAD = 'download',
  UPLOAD = 'upload',
  EXPORT = 'export',
  RESEND = 'resend',
  RESET = 'reset',
  LOGIN = 'login',
  FOLLOW = 'follow',
  UNFOLLOW = 'unfollow',
  UPVOTE = 'upvote',
  DOWNVOTE = 'downvote',
  RATE = 'rate',
  COMMENT = 'comment',
  SEARCH = 'search',
  READ_TIME = 'read_time',
  VIEW_MORE = 'view_more',
  SHARE = 'share',
  BUY_NOW = 'buy_now',
  PAY_NOW = 'pay_now',
  LIKE = 'like',
  BOOKMARK = 'bookmark',
  UNBOOKMARK = 'unbookmark',
  LOGOUT = 'logout',
  VOTE = 'vote',
  NEW_USER = 'new_user',
  ACTIVE_USER = 'active_user',
  VIEW_RECOMMENDED = 'view_recommended',
}

export enum DegreeLevel {
  BACHELOR = 'bachelor',
  MASTER = 'master',
  DOCTORATE = 'doctorate',
  DIPLOMA = 'diploma',
  FELLOWSHIP = 'fellowship',
}

// Enum for Appointment Status
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  Completed = 'completed',
  CANCELED = 'canceled',
}

// create enum for days
export enum Days {
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
  SUNDAY = 'sunday',
}

export enum ModuleName {
  SECTION = 'section',
  USER = 'user',
  AUTH = 'auth',
  TAG = 'tag',
  CATEGORY = 'category',
  FEATURE = 'feature',
  KEYWORD = 'keyword',
  TESTIMONIAL = 'testimonial',
  TREATMENT = 'treatment',
  SPECIALITY = 'speciality',
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  ADMIN = 'admin',
  HOSPITAL = 'hospital',
  AUDIT_TRAIL = 'audittrail',
  DEGREE = 'degree',
  EQUIPMENT = 'equipment',
  FILE_UPLOAD = 'fileupload',
  MEDIA = 'media',
  PAGES = 'pages',
  PRESCRIPTION = 'prescription',
  PROCEDURE = 'procedure',
  SLUG = 'slug',
  HEALTH_PACKAGE = 'health-package',
  APPOINTMENT = 'appointment',
  SLOT = 'slot',
  BLOG = 'blog',
  FAQ = 'faq',
  DEPARTMENT = 'department',
  PATIENT_REPORT = 'patient-report',
  STATIC_PAGE = 'static-page',
  TEST = 'test',
  LOCATION = 'location',
  EVENT = 'event',
  MENU = 'menu',
  PATIENT_MEDICAL_HISTORY = 'medical-history',
  AVAILABILITY = 'availability',
  BANNER = 'banner',
  BANNER_TYPE = 'banner-type',
  POLL = 'poll',
  FORM = 'form',
  NEWS_LETTER = 'news-letter',
  MENU_ITEM = 'menu-item',
  ROLE = 'role',
  SERVICE = 'service',
  COUPON = 'coupon',
  BLOG_CONFIG = 'blog-config',
  PROPERTY = 'property',
  BLOGPOST = 'blogpost',
  CLIENT = 'client',
  SEARCH_CONSOLE = 'searchconsole',
  AUTHOR = 'author',
  ARTICLE = 'article',
  WEBSTORY_TEMPLATE = 'webstory-template',
  REPURPOSE = 'repurpose',
}

export enum PAYMENT_PROVIDER {
  RAZORPAY = 'razorpay',
  PAYPAL = 'paypal',
  PAYTM = 'paytm',
  PAYU = 'payu',
  PAYSTACK = 'paystack',
  PAYONEER = 'payoneer',
}

export enum PAYMENT_EVENT {
  PAYMENT_CAPTURED = 'payment.captured',
  PAYMENT_FAILED = 'payment.failed',
  PAYMENT_REFUNDED = 'payment.refunded',
  PAYMENT_EXPIRED = 'payment.expired',
  PAYMENT_CREATED = 'payment.created',
  PAYMENT_UPDATED = 'payment.updated',
  PAYMENT_COMPLETED = 'payment.completed',
}
// Enum for equipment categories
export enum EquipmentCategory {
  MEDICAL = 'medical',
  INDUSTRIAL = 'industrial',
  LABORATORY = 'laboratory',
}

// Enum for technology types
export enum TechnologyType {
  SOFTWARE = 'software',
  HARDWARE = 'hardware',
}

export enum DaysOfWeek {
  SUNDAY = 'sunday',
  MONDAY = 'monday',
  TUESDAY = 'tuesday',
  WEDNESDAY = 'wednesday',
  THURSDAY = 'thursday',
  FRIDAY = 'friday',
  SATURDAY = 'saturday',
}

export enum DaysOfWeekIndex {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export enum TBloodType {
  A_POSITIVE = 'A+',
  A_NEGATIVE = 'A-',
  B_POSITIVE = 'B+',
  B_NEGATIVE = 'B-',
  O_POSITIVE = 'O+',
  O_NEGATIVE = 'O-',
  AB_POSITIVE = 'AB+',
  AB_NEGATIVE = 'AB-',
}

export enum TSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export enum ContactType {
  EMERGENCY = 'emergency',
  OPDAPPOINTMENT = 'opdappointment',
  PATHOLOGY = 'pathology',
  BILLING = 'billing',
  PHARMACY = 'pharmacy',
  RADIOLOGY = 'radiology',
  SURGERY = 'surgery',
  LABORATORY = 'laboratory',
  AMBULANCE = 'ambulance',
  ADMINISTRATION = 'administration',
  MEDICALRECORDS = 'medicalrecords',
  HEALTHINSURANCE = 'healthinsurance',
  APPOINTMENTS = 'appointments',
}

export enum InsuranceProvider {
  ICICI_LOMBARD = 'ICICI Lombard',
  HDFC_ERGO = 'HDFC ERGO',
  BAJAJ_ALLIANZ = 'Bajaj Allianz',
  RELIANCE_GENERAL = 'Reliance General',
  TATA_AIG = 'Tata AIG',
  NEW_INDIA_ASSURANCE = 'New India Assurance',
  UNITED_INDIA_INSURANCE = 'United India Insurance',
  ORIENTAL_INSURANCE = 'Oriental Insurance',
  NATIONAL_INSURANCE = 'National Insurance',
  STAR_HEALTH = 'Star Health',
  MAX_BUPA = 'Max Bupa',
  APOLLO_MUNICH = 'Apollo Munich',
  FUTURE_GENERALI = 'Future Generali',
  SBI_GENERAL = 'SBI General',
  IFFCO_TOKIO = 'IFFCO Tokio',
  ROYAL_SUNDARAM = 'Royal Sundaram',
  CHOLAMANDALAM_MS = 'Cholamandalam MS',
  UNIVERSAL_SOMPO = 'Universal Sompo',
  LIBERTY_GENERAL = 'Liberty General',
}

export enum AllergyName {
  PEANUT = 'peanut',
  TREE_NUT = 'tree nut',
  MILK = 'milk',
  EGG = 'egg',
  WHEAT = 'wheat',
  SOY = 'soy',
  FISH = 'fish',
  SHELLFISH = 'shellfish',
  SESAME = 'sesame',
  MUSTARD = 'mustard',
  CELERY = 'celery',
  LUPIN = 'lupin',
  MOLLUSKS = 'mollusks',
  SULFITES = 'sulfites',
  GLUTEN = 'gluten',
  CORN = 'corn',
  BEEF = 'beef',
  CHICKEN = 'chicken',
  PORK = 'pork',
  LAMB = 'lamb',
  PEACH = 'peach',
  APPLE = 'apple',
  BANANA = 'banana',
  KIWI = 'kiwi',
  STRAWBERRY = 'strawberry',
  TOMATO = 'tomato',
  POTATO = 'potato',
  CARROT = 'carrot',
  LETTUCE = 'lettuce',
  SPINACH = 'spinach',
  GARLIC = 'garlic',
  ONION = 'onion',
  BROCCOLI = 'broccoli',
  CAULIFLOWER = 'cauliflower',
  CABBAGE = 'cabbage',
  PEPPER = 'pepper',
  CHILI = 'chili',
  MUSHROOM = 'mushroom',
  PEAS = 'peas',
  BEANS = 'beans',
  LENTILS = 'lentils',
  CHICKPEAS = 'chickpeas',
  RICE = 'rice',
  OATS = 'oats',
  BARLEY = 'barley',
  RYE = 'rye',
  BUCKWHEAT = 'buckwheat',
  QUINOA = 'quinoa',
  AMARANTH = 'amaranth',
  MILLET = 'millet',
}

export enum TLocationType {
  STATE = 'state',
  CITY = 'city',
  LOCALITY = 'locality',
}
export enum TDoctorType {
  PART_TIME = 'part-time',
  FULL_TIME = 'full-time',
  VISITING = 'visiting',
}
export enum TCampType {
  CORPORATE = 'Corporate', // For B2B (Business to Business)
  GENERAL_PUBLIC = 'General-public', // For B2C (Business to Consumer)
}
export enum TEventType {
  HEALTH_CAMP = 'Health-camp',
  CONTINUING_MEDICAL_EDUCATION = 'Continuing-medical-education',
}
export enum HealthPackageFrequency {
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  SEMI_ANNUALLY = 'semi-annually',
  ANNUALLY = 'annually',
  BIENNIALLY = 'biennially',
  TRIENNIALLY = 'triennially',
}

export enum SlotDuration {
  FIFTEEN_MINUTES = 15,
  THIRTY_MINUTES = 30,
  FORTY_FIVE_MINUTES = 45,
  SIXTY_MINUTES = 60,
}

export enum BackgroundColor {
  RED = 'red',
  GREEN = 'green',
  BLUE = 'blue',
  YELLOW = 'yellow',
  ORANGE = 'orange',
  PURPLE = 'purple',
  PINK = 'pink',
  BLACK = 'black',
  WHITE = 'white',
  GRAY = 'gray',
}

export enum TestimonialStatus {
  Pending = 'pending',
  Approved = 'approved',
  Rejected = 'rejected',
  DELETED = 'deleted',
  TO_BE_DELETED = 'to_be_deleted',
}
export enum TestType {
  BLOOD_TEST = 'Blood-Test',
  URINE_TEST = 'Urine-Test',
  STOOL_TEST = 'Stool-Test',
  XRAY = 'X-Ray',
  MRI = 'MRI',
  CT_SCAN = 'CT-Scan',
  ULTRASOUND = 'Ultrasound',
  ECG = 'ECG',
  ECHO = 'Echocardiogram',
  ALLERGY_TEST = 'Allergy-Test',
  BLOOD_PRESSURE = 'Blood-Pressure-Measurement',
  PREGNANCY_TEST = 'Pregnancy-Test',
  CHOLESTEROL_TEST = 'Cholesterol-Test',
  LIVER_FUNCTION_TEST = 'Liver-Function-Test',
  KIDNEY_FUNCTION_TEST = 'Kidney-Function-Test',
  GLUCOSE_TEST = 'Glucose-Test',
  THYROID_TEST = 'Thyroid-Function-Test',
  HIV_TEST = 'HIV-Test',
  HORMONE_TEST = 'Hormone-Test',
  VITAMIN_D_TEST = 'Vitamin-D-Test',
  GENETIC_TEST = 'Genetic-Test',
  CANCER_SCREENING = 'Cancer-Screening',
}
export enum SampleType {
  BLOOD = 'Blood',
  URINE = 'Urine',
  SALIVA = 'Saliva',
  STOOL = 'Stool',
  SWAB = 'Swab',
  TISSUE = 'Tissue',
  PLASMA = 'Plasma',
  SERUM = 'Serum',
  CSF = 'Cerebrospinal-Fluid',
  SPUTUM = 'Sputum',
}
export enum ContainerType {
  TUBE = 'Tube',
  URINE_CUP = 'Urine-Cup',
  SWAB_TUBE = 'Swab-Tube',
  SALIVA_COLLECTION_TUBE = 'Saliva-Collection-Tube',
  STOOL_CONTAINER = 'Stool-Container',
  CSF_TUBE = 'CSF-Tube',
}

export enum BannerOpenIn {
  SAME = 'same',
  NEW = 'new',
}

export enum BannerRunsOn {
  MOBILE = 'mobile',
  WEB = 'web',
  BOTH = 'both',
}
export enum DeviceType {
  ANDROID = 'Android',
  IOS = 'iOS',
  WEB = 'web',
  MAC = 'mac',
  WINDOW = 'windows',
  LINUX = 'linux',
  DESKTOP = 'Desktop',
  PHONE = 'Phone',
  OTHER = 'Other',
}
export enum Visibility {
  HIDDEN = 'hidden',
  VISIBLE = 'visible',
}
export enum FileType {
  PDF = 'pdf',
  DOC = 'doc',
  DOCX = 'docx',
  JPG = 'jpg',
  PNG = 'png',
  GIF = 'gif',
  XLS = 'xls',
  XLSX = 'xlsx',
  PPT = 'ppt',
  PPTX = 'pptx',
  TXT = 'txt',
  CSV = 'csv',
}
export enum FileSize {
  TWO_MB = '2mb',
  FOUR_MB = '4mb',
  SIX_MB = '6mb',
  EIGHT_MB = '8mb',
  TEN_MB = '10mb',
}
export enum FieldType {
  Text = 'text',
  Email = 'email',
  Number = 'number',
  Checkbox = 'checkbox',
  Radio = 'radio',
  Select = 'select',
  File = 'file',
  Tel = 'tel',
}
export enum NEWS_LETTER_STATUS {
  DRAFT = 'draft',
  SCHEDULED = 'scheduled',
  SENT = 'sent',
  FAILED = 'failed',
  DELETED = 'deleted',
}

export enum NEWS_LETTER_AUDIENCE {
  // ALL = 'all',
  SUBSCRIBERS = 'subscribers',
  SPECIFIC_USERS = 'specificUsers',
}
export enum NEWS_LETTER_FREQUENCY {
  DAILY = 'daily',
  WEEKLY = 'weekly',
  MONTHLY = 'monthly',
  QUARTERLY = 'quarterly',
  HALF_YEARLY = 'half_yearly',
  YEARLY = 'yearly',
  ONE_TIME = 'one-time',
}
export enum BATCH_SIZE {
  EMAIL = 100,
  USER = 1500,
}

export enum GoogleServiceType {
  SEARCH_CONSOLE = 'search_console',
  ANALYTICS = 'analytics',
}
