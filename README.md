<p align="center">
  <h1 align="center">Odin CMS</h1>
  <p align="center">
    An open-source, AI-powered headless CMS for modern content teams.
    <br />
    <a href="#features">Features</a> · <a href="#quick-start">Quick Start</a> · <a href="#contributing">Contributing</a> · <a href="#license">License</a>
  </p>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT" /></a>
  <a href="https://github.com/AST-Consulting/odin/issues"><img src="https://img.shields.io/github/issues/AST-Consulting/odin.svg" alt="GitHub Issues" /></a>
  <a href="https://github.com/AST-Consulting/odin/pulls"><img src="https://img.shields.io/github/issues-pr/AST-Consulting/odin.svg" alt="GitHub PRs" /></a>
</p>

---

## What is Odin CMS?

Odin CMS is a full-featured, AI-enhanced headless content management system built for editorial teams, publishers, and digital content creators. It combines a powerful NestJS backend with a modern Next.js dashboard to provide a seamless content authoring, publishing, and analytics experience.

## Features

- **📝 Rich Content Editor** — Block-based editor (BlockNote) with AI-assisted writing, formatting, and content generation.
- **🤖 AI Studio** — One-click content repurposing (articles → social media posts, carousels, video scripts), AI video generation, and smart content suggestions.
- **📊 Analytics Dashboard** — Integrated Google Analytics and YouTube Analytics with real-time metrics, traffic charts, and audience insights.
- **🔍 SEO Tools** — Built-in SEO auditing, slug management, robots.txt editor, and sitemap generation.
- **👥 Multi-Tenant** — Organizations, properties, and role-based access control (RBAC) with granular permissions.
- **📂 Media Management** — Upload, crop, watermark, and serve images via AWS S3 or local storage with automatic variant generation.
- **🔄 Content Workflow** — Kanban-style editorial workflow with draft, review, and publish states.
- **📋 Dynamic Content Builder** — Create custom content types with a visual schema editor (like Strapi's Content-Type Builder).
- **🔗 Integrations** — Google OAuth, LinkedIn, Twitter/X, WordPress migration, and Brevo email.
- **📱 Responsive Dashboard** — Fully responsive admin UI built with Radix UI, TailwindCSS, and Framer Motion.

## Tech Stack

| Layer | Technologies |
|---|---|
| **Backend** | NestJS 10 · TypeScript · Mongoose/MongoDB · Redis · BullMQ · Elasticsearch 8 |
| **Frontend** | Next.js 16 · React 19 · TailwindCSS 3 · Radix UI · Zustand · React Query |
| **AI** | Google Gemini · OpenAI · AWS Bedrock |
| **Auth** | Passport JWT · Google OAuth 2.0 |
| **Infrastructure** | Docker · pnpm workspaces |

## Architecture

```
odin/
├── backend/          # NestJS API server
│   └── src/
│       ├── ai/               # AI content generation
│       ├── analytics/        # GA & YouTube analytics
│       ├── articles/         # Article CRUD & publishing
│       ├── auth/             # Authentication & RBAC
│       ├── content-builder/  # Dynamic content types
│       ├── core/             # Guards, decorators, utils
│       ├── entries/          # Dynamic content entries
│       ├── integrations/     # Third-party integrations
│       ├── repurpose/        # Content repurposing engine
│       ├── video-generation/ # AI video pipeline
│       └── ...
├── frontend/         # Next.js dashboard
│   └── src/
│       ├── app/              # App Router pages
│       ├── components/       # UI components
│       ├── hooks/            # Custom React hooks
│       ├── lib/              # API client, store, utils
│       └── styles/           # Global CSS
├── docker-compose.yml
└── README.md
```

## Quick Start

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 9 (`npm install -g pnpm`)
- **MongoDB** ≥ 6
- **Redis** ≥ 7
- **Elasticsearch** ≥ 8 *(optional, for search)*

### 1. Clone the repository

```bash
git clone https://github.com/AST-Consulting/odin.git
cd odin
```

### 2. Start infrastructure (Docker)

```bash
docker compose up -d
```

This starts MongoDB, Redis, and Elasticsearch containers.

### 3. Configure environment

```bash
# Backend
cp backend/.env.example backend/.env

# Frontend
cp frontend/.env.example frontend/.env.local
```

Edit the `.env` files and fill in your secrets (JWT secret, database URI, API keys, etc.).

### 4. Install dependencies

```bash
# Backend
cd backend && pnpm install

# Frontend
cd ../frontend && pnpm install
```

### 5. Start development servers

```bash
# Terminal 1 — Backend (port 4000)
cd backend && pnpm run start:dev

# Terminal 2 — Frontend (port 3001)
cd frontend && pnpm run dev
```

Open **http://localhost:3001** in your browser.

## Environment Variables

### Backend (`backend/.env`)

| Variable | Description | Required |
|---|---|---|
| `DATABASE_URI` | MongoDB connection string | ✅ |
| `REDIS_HOST` | Redis hostname | ✅ |
| `REDIS_PORT` | Redis port (default: `6379`) | ✅ |
| `JWT_SECRET` | JWT signing secret | ✅ |
| `JWT_ACCESS_TOKEN_SECRET` | Access token secret | ✅ |
| `JWT_REFRESH_SECRET` | Refresh token secret | ✅ |
| `PORT` | API server port (default: `4000`) | |
| `CORS_ORIGINS` | Allowed CORS origins | |
| `FRONTEND_URL` | Frontend URL for redirects | |
| `AWS_ACCESS_KEY` | AWS S3 access key | If using S3 |
| `AWS_SECRET_KEY` | AWS S3 secret key | If using S3 |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | If using Google auth |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | If using Google auth |

See `backend/.env.example` for the full list.

### Frontend (`frontend/.env.local`)

| Variable | Description | Required |
|---|---|---|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | ✅ |
| `NEXT_PUBLIC_CDN_URL` | CDN base URL for media | |

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) for details on:

- How to fork and set up the project
- Branch naming conventions
- Commit message format
- How to submit a pull request

Please also review our [Code of Conduct](CODE_OF_CONDUCT.md).

## Security

If you discover a security vulnerability, please follow our [Security Policy](SECURITY.md) for responsible disclosure. **Do not open a public issue.**

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<p align="center">
  Built with ❤️ by <a href="https://github.com/AST-Consulting">AST Consulting</a>
</p>
