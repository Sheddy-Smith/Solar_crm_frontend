# Git Push Commands

Run these commands from:

```powershell
C:\Malwa_Solar_CRM
```

## Every time you have changes to push

```powershell
git status
git add -A
git commit -m "Describe what changed here"
git push origin main
```

- `git status` — check what changed before staging.
- `git add -A` — stages everything (modified, new, deleted). Use `git add <path>` instead if you only want to push specific files.
- `git commit -m "..."` — replace the message with a short description of this change.
- `git push origin main` — sends it to GitHub.

## If push asks to set upstream or branch is not linked

```powershell
git push -u origin main
```

## If push fails with "Invalid username or token. Password authentication is not supported"

GitHub no longer accepts a plain username + password over HTTPS — you need a Personal Access Token (PAT):

1. GitHub → Settings → Developer settings → Personal access tokens → Generate new token.
2. When `git push` asks for a password, paste the token instead.
3. To avoid re-entering it every time, make sure Git Credential Manager is active: `git config --global credential.helper manager`.

Alternative: ask Claude to commit/push for you in this session instead — it already has a working authenticated git setup here.
