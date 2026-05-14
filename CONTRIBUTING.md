# Contributing to Odin CMS

Thank you for your interest in contributing to Odin CMS! This guide will help you get started.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

This project adheres to the [Contributor Covenant Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code. Please report unacceptable behavior to [opensource@astconsulting.in](mailto:opensource@astconsulting.in).

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/odin.git
   cd odin
   ```
3. **Set up** the development environment by following the [Quick Start](README.md#quick-start) guide.
4. **Create a branch** for your work:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Workflow

### Branch Naming

Use the following prefixes:

| Prefix | Use Case |
|---|---|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation changes |
| `refactor/` | Code refactoring |
| `test/` | Adding or updating tests |
| `chore/` | Maintenance tasks |

### Project Structure

- **Backend code** → `backend/src/`
- **Frontend code** → `frontend/src/`

### Running Tests

```bash
# Backend tests
cd backend && pnpm test

# Frontend tests
cd frontend && pnpm test
```

### Linting

```bash
# Backend
cd backend && pnpm lint

# Frontend
cd frontend && pnpm lint
```

## Commit Messages

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `perf`, `ci`, `build`

**Examples:**
```
feat(articles): add bulk publish action
fix(auth): resolve token refresh race condition
docs(readme): update setup instructions
```

## Pull Requests

1. **Keep PRs focused** — one feature or fix per PR.
2. **Update documentation** if your changes affect the public API or setup process.
3. **Write/update tests** for any new functionality.
4. **Fill out the PR template** completely.
5. **Ensure CI passes** before requesting review.

### PR Checklist

- [ ] I have read the [Contributing Guide](CONTRIBUTING.md).
- [ ] My code follows the existing code style.
- [ ] I have added/updated tests as needed.
- [ ] I have updated documentation as needed.
- [ ] All tests pass locally.

## Reporting Bugs

Use the [Bug Report](https://github.com/AST-Consulting/odin/issues/new?template=bug_report.md) issue template. Include:

- Steps to reproduce
- Expected vs actual behavior
- Screenshots (if applicable)
- Environment details (OS, Node version, browser)

## Requesting Features

Use the [Feature Request](https://github.com/AST-Consulting/odin/issues/new?template=feature_request.md) issue template. Describe:

- The problem you're trying to solve
- Your proposed solution
- Alternatives you've considered

---

Thank you for helping make Odin CMS better! 🎉
