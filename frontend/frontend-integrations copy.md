# Frontend Guide: Google Integrations API

> **Base URL:** `http://localhost:4000` (local) or your production domain.
> **Auth:** All endpoints (except the OAuth callback) require `Authorization: Bearer <JWT_TOKEN>` header.

---

## Complete Flow

```
1. POST /v1/integrations/connect           → Get OAuth URL (Google/YouTube/Meta)
2. User completes Google/Meta consent       → Backend saves tokens (status: "pending_selection")
3. GET /v1/integrations/accounts/ga4/:id   → List GA4 properties to choose from
   GET /v1/integrations/accounts/gsc/:id   → List GSC sites to choose from
   GET /v1/integrations/accounts/youtube/:id → List YouTube channels to choose from
   GET /v1/integrations/accounts/facebook/:id  → List Facebook Pages to choose from
   GET /v1/integrations/accounts/instagram/:id → List Instagram Accounts to choose from
4. POST /v1/integrations/select             → Map user's selected account to CMS property
                                              (status: "connected")
5. GET /v1/integrations/analytics/ga4/:id  → Fetch GA4 traffic data
   GET /v1/integrations/analytics/gsc/:id  → Fetch Search Console data
   GET /v1/integrations/analytics/youtube/:id → Fetch YouTube Analytics
   GET /v1/integrations/analytics/facebook/:id  → Fetch FB Page Insights
   GET /v1/integrations/analytics/instagram/:id → Fetch IG Account Insights
```

---

## API Endpoints

### `POST` /v1/integrations/connect
Initiate the Google OAuth flow. Returns a URL to redirect the user to.

**Request Body:**
```json
{
  "propertyId": "65ab...cdef",
  "provider": "google_analytics",
  "redirectUrl": "http://localhost:3001/dashboard/settings/integrations"
}
```
> `provider`: `"google_analytics"`, `"search_console"`, `"youtube"`, `"facebook"`, or `"instagram"`

**Response:**
```json
{ "url": "https://accounts.google.com/o/oauth2/v2/auth?..." }
```
**Action:** `window.location.href = response.url`

---

### `GET` /v1/integrations/google/callback
> ⚠️ **Do NOT call this.** Google redirects here automatically. Backend processes tokens and redirects user back to `redirectUrl`.

---

### `GET` /v1/integrations/meta/callback
> ⚠️ **Do NOT call this.** Meta redirects here automatically. Backend processes tokens and redirects user back to `redirectUrl`.

---

### `GET` /v1/integrations/accounts/ga4/:propertyId
List GA4 properties available in the user's Google account (call this AFTER OAuth).

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "123456789",
      "accountLabel": "My Website - GA4",
      "accountName": "My Google Account",
      "propertyName": "properties/123456789"
    },
    {
      "accountId": "987654321",
      "accountLabel": "Blog Analytics",
      "accountName": "My Google Account",
      "propertyName": "properties/987654321"
    }
  ]
}
```

---

### `GET` /v1/integrations/accounts/gsc/:propertyId
List Search Console sites available in the user's Google account.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "sc-domain:example.com",
      "accountLabel": "sc-domain:example.com",
      "permissionLevel": "siteOwner"
    },
    {
      "accountId": "https://blog.example.com/",
      "accountLabel": "https://blog.example.com/",
      "permissionLevel": "siteFullUser"
    }
  ]
}
```

---

### `GET` /v1/integrations/accounts/youtube/:propertyId
List YouTube channels owned by the user.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "UC1234567890abcdefg",
      "accountLabel": "My Awesome Channel",
      "statistics": {
         "viewCount": "150000",
         "subscriberCount": "1200",
         "videoCount": "45"
      },
      "thumbnailUrl": "https://yt3.ggpht.com/..."
    }
  ]
}
```

---

### `GET` /v1/integrations/accounts/facebook/:propertyId
List Facebook Pages where the user has Admin rights.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "10020202020",
      "accountLabel": "My FB Page",
      "pageAccessToken": "EAABxyz...",
      "thumbnailUrl": "https://scontent...",
      "followersCount": 12500
    }
  ]
}
```

---

### `GET` /v1/integrations/accounts/instagram/:propertyId
List Instagram Business Accounts attached to the user's Facebook Pages.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "accountId": "1784140000000",
      "accountLabel": "my_ig_handle",
      "pageAccessToken": "EAABxyz...",
      "thumbnailUrl": "https://scontent..."
    }
  ]
}
```

---

### `POST` /v1/integrations/select
Map the user's selected GA4 property or GSC site to the CMS property. Show a dropdown from the list above and submit the selection here.

**Request Body:**
```json
{
  "propertyId": "65ab...cdef",
  "provider": "google_analytics",
  "accountId": "123456789",
  "accountLabel": "My Website - GA4"
}
```
> **Note:** `pageAccessToken` is REQUIRED in the payload for `facebook` and `instagram` selection, but should be omitted for Google services.

**Response:**
```json
{
  "success": true,
  "message": "Successfully mapped google_analytics account",
  "data": {
    "provider": "google_analytics",
    "status": "connected",
    "metadata": { "propertyId": "123456789", "label": "My Website - GA4" }
  }
}
```

---

### `GET` /v1/integrations/property/:propertyId
List all integrations (connected, pending, disconnected) for a CMS property.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "65ba...",
      "provider": "google_analytics",
      "status": "connected",
      "metadata": { "propertyId": "123456789", "label": "My Website" },
      "updatedAt": "2024-03-10T10:00:00.000Z"
    },
    {
      "_id": "65bb...",
      "provider": "search_console",
      "status": "pending_selection",
      "metadata": {},
      "updatedAt": "2024-03-10T10:05:00.000Z"
    }
  ]
}
```

---

### `POST` /v1/integrations/disconnect/:propertyId/:provider
**Soft disconnect** — clears tokens but keeps the record.

**Response:**
```json
{ "success": true, "message": "Successfully disconnected google_analytics" }
```

---

### `DELETE` /v1/integrations/delete/:propertyId/:provider
**Hard delete** — permanently removes the integration record.

**Response:**
```json
{ "success": true, "message": "Successfully deleted google_analytics integration" }
```

---

### `GET` /v1/integrations/analytics/ga4/:propertyId
Fetch GA4 traffic summary. Only works when status is `connected`.

**Query Params:** `startDate` (default: `30daysAgo`), `endDate` (default: `today`)

**Response:**
```json
{
  "success": true,
  "data": { "views": 45000, "activeUsers": 12000, "sessions": 15000, "engagedSessions": 9000 }
}
```

---

### `GET` /v1/integrations/analytics/ga4/:propertyId/top-pages
Fetch top pages from GA4.

**Query Params:** `limit` (default: `10`), `startDate`, `endDate`

**Response:**
```json
{
  "success": true,
  "data": [
    { "path": "/blog/my-article", "title": "My Article", "views": 5200 }
  ]
}
```

---

### `GET` /v1/integrations/analytics/gsc/:propertyId
Fetch Search Console performance. Only works when status is `connected`.

**Query Params:** `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "clicks": 1500,
    "impressions": 45000,
    "ctr": 3.33,
    "position": 12.5,
    "dailyData": [
      { "keys": ["2024-03-01"], "clicks": 45, "impressions": 1200, "ctr": 0.0375, "position": 11.2 }
    ]
  }
}
```

---

### `GET` /v1/integrations/analytics/youtube/:propertyId
Fetch YouTube Analytics output. Only works when status is `connected`.

**Query Params:** `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "views": 45000,
    "estimatedMinutesWatched": 120000,
    "netSubscribersGained": 150,
    "dailyData": [
      { 
         "date": "2024-03-01", 
         "views": 450, 
         "estimatedMinutesWatched": 1200, 
         "averageViewDuration": 160,
         "subscribersGained": 10,
         "subscribersLost": 2
      }
    ]
  }
}
```

---

### `GET` /v1/integrations/analytics/facebook/:propertyId
Fetch Facebook Page Insights (`page_impressions`, `page_engaged_users`).

**Query Params:** `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "impressions": 150000,
    "engagedUsers": 2500,
    "dailyData": [
      { "date": "2024-03-01", "impressions": 5000, "engagedUsers": 80 }
    ]
  }
}
```

---

### `GET` /v1/integrations/analytics/instagram/:propertyId
Fetch Instagram Account Insights (`reach`, `impressions`).

**Query Params:** `startDate` (YYYY-MM-DD), `endDate` (YYYY-MM-DD)

**Response:**
```json
{
  "success": true,
  "data": {
    "reach": 85000,
    "impressions": 120000,
    "dailyData": [
      { "date": "2024-03-01", "reach": 2500, "impressions": 4000 }
    ]
  }
}
```

---

## Status Values

| Value | Meaning |
|---|---|
| `pending_selection` | OAuth done, user needs to pick a GA4 property or GSC site |
| `connected` | Fully connected and ready to fetch data |
| `disconnected` | Soft-disconnected (tokens cleared, record kept) |
| `expired` | Token expired, needs re-auth |
| `error` | Connection error |

## Provider Values

| Value | Description |
|---|---|
| `google_analytics` | Google Analytics 4 |
| `search_console` | Google Search Console |
| `youtube` | YouTube Analytics |
| `facebook` | Facebook Page Insights & Publishing |
| `instagram` | Instagram Analytics & Publishing |
