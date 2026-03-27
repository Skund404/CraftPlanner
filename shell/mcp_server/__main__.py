"""stdio transport entry point for the CraftPlanner MCP server.

Run with:
    python -m mcp_server
    craftplanner mcp

This starts the MCP server on stdin/stdout for direct process-level
integration with Claude Code and other local AI tools.

Configure via environment variables:
    CRAFTPLANNER_SHELL_URL    Shell base URL (default: http://localhost:3000)
    CRAFTPLANNER_SHELL_TOKEN  Bearer token if Shell auth is enabled (default: empty)
"""

import asyncio

from .server import create_server


async def main() -> None:
    """Run the MCP server over stdio."""
    mcp = create_server()
    await mcp.run_stdio_async()


if __name__ == "__main__":
    asyncio.run(main())
