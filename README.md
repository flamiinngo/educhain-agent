# NEXUS — The Agent Orchestration Layer for Xyber

NEXUS is the brain of the Xyber ecosystem. It coordinates multiple AI agents via MCP and x402 payments to deliver unified intelligence no single agent can produce.

## What It Does

Give NEXUS a goal → it figures out which agents to call → coordinates them → returns a unified answer.

**Example:**
```
User: "Find me the safest new token launch this week"

NEXUS:
1. Calls Tavily → scans web for new launches
2. Calls Quill → security analysis on each
3. Calls GitParser → code quality check
4. Synthesizes → ranks by safety × upside
5. Returns: Top opportunities with scores and reasoning
```

## Agents NEXUS Orchestrates

| Agent | What It Does | Xyber MCP Server |
|-------|-------------|-----------------|
| Quill | Token security analysis | mcp-quill.xyber.inc |
| Tavily | Web search & sentiment | mcp-tavily.xyber.inc |
| ArXiv | Research papers | mcp-arxiv.xyber.inc |
| Wikipedia | Knowledge base | mcp-wikipedia.xyber.inc |
| GitParser | Code & repo analysis | mcp-gitparser.xyber.inc |

## MCP Tools

| Tool | Description | Price |
|------|-------------|-------|
| `orchestrate` | Any goal → multi-agent coordination | $0.001 |
| `evaluate_token` | Token safety score (Quill+Tavily+GitParser) | $0.002 |
| `discover_opportunities` | Find alpha (Tavily+ArXiv+Quill) | $0.002 |
| `research_topic` | Deep research (ArXiv+Wikipedia+Tavily) | $0.001 |

## Endpoints

| URL | Type | Description |
|-----|------|-------------|
| `/api/health` | REST | Health check |
| `/api/stats` | REST | Orchestration statistics |
| `/hybrid/pricing` | REST+MCP | Tool pricing |
| `/hybrid/agents` | REST+MCP | Agent registry |
| `/mcp` | MCP | Agent endpoint |
| `/docs` | REST | Swagger UI |

## Built on Xyber

- **x402 payments** — NEXUS charges for orchestration AND pays downstream agents
- **MCP protocol** — Standard agent communication
- **PROOF rails** — Verifiable execution logs
- **Xyber App Store** ready

## License

MIT
