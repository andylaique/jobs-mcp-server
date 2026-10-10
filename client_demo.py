#!/usr/bin/env python3
"""
Standalone demo client that exercises every tool.
Run with: python client_demo.py
(No MCP Inspector or Claude required.)
"""

import asyncio
import json
from mcp import Client
from server import mcp


async def main() -> None:
    async with Client(mcp) as client:
        print("=" * 60)
        print("list_skills()")
        print("=" * 60)
        result = await client.call_tool("list_skills", {})
        print(json.dumps(result.structured_content or result.content, indent=2))

        print("\n" + "=" * 60)
        print("search_postings_by_skill(skill='Python', limit=5)")
        print("=" * 60)
        result = await client.call_tool(
            "search_postings_by_skill", {"skill": "Python", "limit": 5}
        )
        print(json.dumps(result.structured_content or result.content, indent=2))

        print("\n" + "=" * 60)
        print("search_postings_by_skill(skill='React', remote_only=True)")
        print("=" * 60)
        result = await client.call_tool(
            "search_postings_by_skill",
            {"skill": "React", "remote_only": True},
        )
        print(json.dumps(result.structured_content or result.content, indent=2))

        print("\n" + "=" * 60)
        print("count_postings_by_company()")
        print("=" * 60)
        result = await client.call_tool("count_postings_by_company", {})
        print(json.dumps(result.structured_content or result.content, indent=2))

        print("\n" + "=" * 60)
        print("count_postings_by_company(company='Tech')")
        print("=" * 60)
        result = await client.call_tool(
            "count_postings_by_company", {"company": "Tech"}
        )
        print(json.dumps(result.structured_content or result.content, indent=2))

        print("\n" + "=" * 60)
        print("get_job_by_id(job_id=1)")
        print("=" * 60)
        result = await client.call_tool("get_job_by_id", {"job_id": 1})
        print(json.dumps(result.structured_content or result.content, indent=2))

        # Bad input demos
        print("\n" + "=" * 60)
        print("BAD INPUT: search_postings_by_skill(skill='')")
        print("=" * 60)
        try:
            await client.call_tool("search_postings_by_skill", {"skill": ""})
        except Exception as e:
            print(f"Caught expected error: {e}")

        print("\n" + "=" * 60)
        print("BAD INPUT: get_job_by_id(job_id=999)")
        print("=" * 60)
        try:
            await client.call_tool("get_job_by_id", {"job_id": 999})
        except Exception as e:
            print(f"Caught expected error: {e}")


if __name__ == "__main__":
    asyncio.run(main())
