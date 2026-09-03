# Contributing

Thanks for taking the time to contribute.

## Branching

Branch off `main` (or the current active development branch) using one of these prefixes:

- `feature/short-description`: new functionality
- `fix/short-description`: bug fixes
- `docs/short-description`: documentation only

## Making a change

1. Fork the repository and create your branch from `main`.
2. Make your changes, keeping commits focused and the message descriptive (what changed and why, not just what file).
3. Run the backend test suite (`python manage.py test apps`) and the frontend build (`npm run build`) before opening a PR. Both should be clean.
4. Open a pull request against `main` using the PR template. Link any related issue.

## Code style

- **Backend**: standard PEP 8, Django conventions. Keep views and services separated the way the existing `apps/<name>/views.py` / `apps/<name>/services/` structure does.
- **Frontend**: match the existing component structure under `src/pages` and `src/components`. Tailwind utility classes over custom CSS where practical.
- Keep pull requests scoped to one concern. A refactor and a feature in the same PR is harder to review and harder to revert if something goes wrong.

## Reporting bugs / requesting features

Use the issue templates under `.github/ISSUE_TEMPLATE/`. Include real reproduction steps for bugs: what you did, what you expected, and what actually happened.

## Security issues

Do not open a public issue for a security vulnerability. See [SECURITY.md](SECURITY.md).
