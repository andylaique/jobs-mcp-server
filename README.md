# Jobs MCP Server

A small, production-ready **Model Context Protocol (MCP)** server built with the official Python SDK (`mcp` ≥ 2.3).  
It exposes tools over a curated dataset of 12 software job postings.

## Tools

| Tool | Description | Typed inputs |
|------|-------------|--------------|
| `search_postings_by_skill` | Find postings that require a given skill (case-insensitive). Optional remote-only filter and limit. | `skill: str`, `limit: int = 10` (1-50), `remote_only: bool = false` |
| `count_postings_by_company` | Count postings grouped by company. Optional partial company name filter. | `company: str \| null` |
| `get_job_by_id` | Return the full record for a single posting. | `job_id: int` (≥ 1) |
| `list_skills` | List every unique skill present in the dataset. | *(none)* |

All inputs are validated with **Pydantic**. Invalid values raise clear `ValueError` messages that the host/LLM can surface to the user.

## Quick start

```bash
# Requires Python 3.10+
pip install -r requirements.txt

# Run over stdio (Claude Desktop, MCP Inspector, Cursor, etc.)
python server.py

# Or use the official CLI + Inspector UI
mcp dev server.py
```

### Standalone proof (no Inspector needed)

```bash
python client_demo.py
```

This exercises every tool and shows the helpful error messages for bad input.

### MCP Inspector

```bash
mcp dev server.py
```

Open the printed URL → **Tools** tab → call any tool. The form fields are generated from the type hints and Field descriptions.

## Sample dataset

`data/jobs.json` contains 12 realistic postings across companies (TechNova, CloudScale, PixelCraft, HealthSync, …) with skills, salary ranges, remote flags, and posting dates.

## HTTP transport (stretch)

```bash
python -c "
from server import mcp
mcp.run(transport='streamable-http', host='0.0.0.0', port=8000)
"
# Endpoint: http://localhost:8000/mcp
```

## Protecting the server with OAuth 2.0

When the server is exposed over **Streamable HTTP** (or SSE) it becomes an ordinary web resource server. Protect it exactly like any other API: with **OAuth 2.1 bearer tokens**.

### Recommended flow

**Authorization Code flow with PKCE** (OAuth 2.1).

- Suitable for both public clients (desktop / SPA) and confidential clients.
- PKCE is **mandatory** (prevents authorization-code interception).
- No implicit or resource-owner-password grants.

### Where tokens are checked

On **every request** that hits the MCP endpoint:

1. The transport middleware extracts the `Authorization: Bearer <token>` header.
2. The configured `TokenVerifier` (e.g. `JWTTokenVerifier` against your IdP’s JWKS, or an introspection endpoint) validates:
   - signature / issuer
   - expiry
   - audience / resource indicator (RFC 8707) – must match this server’s public URL
   - required scopes
3. If verification fails → `401 Unauthorized` (or `403` for insufficient scope).
4. On success the verified `AccessToken` is available to the tool handlers if needed.

In the official SDK this is wired by passing both:

```python
from mcp.server import MCPServer
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.provider import TokenVerifier, AccessToken
from pydantic import AnyHttpUrl

class MyJWTVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        # verify JWT / call introspection, return AccessToken or None
        ...

mcp = MCPServer(
    "jobs-mcp",
    token_verifier=MyJWTVerifier(...),
    auth=AuthSettings(
        issuer_url=AnyHttpUrl("https://auth.your-idp.com"),
        resource_server_url=AnyHttpUrl("https://jobs-mcp.example.com/mcp"),
        required_scopes=["jobs:read"],
        validate_token_resource=True,  # enforce RFC 8707 resource binding
    ),
)
```

The server also publishes `/.well-known/oauth-protected-resource` (RFC 9728) so clients can discover the authorization server automatically.

### Suggested scopes

| Scope | Meaning |
|-------|---------|
| `jobs:read` | Call any read-only tool (`search_*`, `count_*`, `get_*`, `list_*`) |
| `jobs:search` | Only the search / list tools (stricter) |
| `jobs:admin` | Future write / admin tools |

Clients request the scopes they need; the resource server rejects tokens that lack the required ones.

### Identity provider

Use any OAuth 2.1-compliant IdP (Auth0, Keycloak, WorkOS, Entra ID, Cognito, …).  
Do **not** implement the authorization server yourself unless you have a strong reason; the MCP server should remain a pure **resource server**.

## Frontend (Next.js + Gemini)

See the `frontend/` directory. It provides a clean chat UI where users paste their Gemini API key and can ask natural-language questions about the job data. The backend implements the same tool set (or proxies to the MCP server) and lets Gemini perform function calling.

```bash
cd frontend
cp .env.example .env.local   # optional server-side key
npm install
npm run dev
```

Open http://localhost:3000.

## License

MIT
