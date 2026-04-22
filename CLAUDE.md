# Project Rules for Claude

## Writing Style

- Do not use em dashes (--) in any output, comments, documentation, or code strings.
  Use commas, colons, semicolons, or restructure the sentence instead.
- Do not attribute authorship to Claude. Do not write "Written by Skyler and Claude,"
  "Co-authored by Claude," or any similar attribution. The developer is the author.
  Claude is a tool, not a collaborator with a byline.

## AI Integration Rules

- All calls to the Anthropic API must load their system prompts from `backend/prompts/`.
  Do not hardcode prompt text inside Python source files.
- Use `claude-sonnet-4-6` unless a specific endpoint requires a different model.
  Never use a model not defined in `app/core/config.py`.
- All AI responses that return structured data must go through a Pydantic model
  before being used by the application. Never parse raw JSON strings directly
  into application logic without validation.
- Always apply `cache_control: {type: "ephemeral"}` to system prompts so repeated
  requests within the 5-minute TTL window read the cached prefix.

## Security Rules

- Never put `ANTHROPIC_API_KEY` or any secret in source code. Use `.env` only.
  The `.env` file is in `.gitignore` and must never be committed.
- Validate all user-supplied input at API boundaries using Pydantic before
  passing it to any service, database query, or AI call.

## Code Style

- Follow the tech stack defined in `PRODUCT_SPEC.md`. Do not introduce new
  dependencies without updating that document.
- FastAPI route handlers must be `async`. All database and AI calls must use
  their async clients.
- Keep route handlers thin. Business logic lives in `app/services/`.
- Do not add comments that describe what the code does. Only add a comment
  when the reason behind a decision is non-obvious.

## File Structure Rules

- Prompts: `backend/prompts/<name>.md`
- Pydantic models for AI output: defined in the service file that uses them
- Settings: `backend/app/core/config.py` only
- Do not create new top-level directories without updating `PRODUCT_SPEC.md`
