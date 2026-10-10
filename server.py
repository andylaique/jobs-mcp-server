#!/usr/bin/env python3
"""
Jobs MCP Server
Exposes tools over a sample dataset of job postings.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from mcp.server import MCPServer
from pydantic import BaseModel, Field, ValidationError, field_validator

# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

DATA_PATH = Path(__file__).parent / "data" / "jobs.json"


def load_jobs() -> list[dict[str, Any]]:
    with open(DATA_PATH, encoding="utf-8") as f:
        return json.load(f)


JOBS: list[dict[str, Any]] = load_jobs()

# ---------------------------------------------------------------------------
# Input models (Pydantic) – give clear validation errors
# ---------------------------------------------------------------------------


class SearchBySkillInput(BaseModel):
    skill: str = Field(
        ...,
        min_length=1,
        max_length=64,
        description="Skill to search for (case-insensitive, e.g. 'Python', 'React')",
    )
    limit: int = Field(
        default=10,
        ge=1,
        le=50,
        description="Maximum number of postings to return (1-50)",
    )
    remote_only: bool = Field(
        default=False,
        description="If true, only return remote-friendly postings",
    )

    @field_validator("skill")
    @classmethod
    def skill_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("skill must not be empty or whitespace")
        return v


class CountByCompanyInput(BaseModel):
    company: str | None = Field(
        default=None,
        max_length=128,
        description="Optional company name filter (case-insensitive partial match). "
        "If omitted, returns counts for all companies.",
    )

    @field_validator("company")
    @classmethod
    def company_strip(cls, v: str | None) -> str | None:
        if v is None:
            return None
        v = v.strip()
        return v or None


class GetJobInput(BaseModel):
    job_id: int = Field(..., ge=1, description="Numeric job ID")


# ---------------------------------------------------------------------------
# Server
# ---------------------------------------------------------------------------

mcp = MCPServer(
    "jobs-mcp",
    instructions=(
        "You have access to a curated set of software job postings. "
        "Use the tools to search by skill, count postings by company, "
        "or fetch a single posting by ID."
    ),
)


@mcp.tool()
def search_postings_by_skill(
    skill: str,
    limit: int = 10,
    remote_only: bool = False,
) -> list[dict[str, Any]]:
    """
    Search job postings that require a given skill.

    Matches are case-insensitive and look inside the skills list of each posting.
    Returns a list of matching postings (id, title, company, location, skills, salary range).
    Raises a clear error if the skill is empty or limit is out of range.
    """
    try:
        args = SearchBySkillInput(skill=skill, limit=limit, remote_only=remote_only)
    except ValidationError as e:
        # Surface the first useful message
        msg = e.errors()[0].get("msg", str(e))
        raise ValueError(f"Invalid input: {msg}") from e

    skill_lower = args.skill.lower()
    matches: list[dict[str, Any]] = []
    for job in JOBS:
        skills = [s.lower() for s in job.get("skills", [])]
        if skill_lower in skills or any(skill_lower in s for s in skills):
            if args.remote_only and not job.get("remote", False):
                continue
            matches.append(
                {
                    "id": job["id"],
                    "title": job["title"],
                    "company": job["company"],
                    "location": job["location"],
                    "remote": job["remote"],
                    "skills": job["skills"],
                    "salary_min": job["salary_min"],
                    "salary_max": job["salary_max"],
                    "posted_at": job["posted_at"],
                }
            )
            if len(matches) >= args.limit:
                break

    return matches


@mcp.tool()
def count_postings_by_company(company: str | None = None) -> dict[str, Any]:
    """
    Count job postings grouped by company.

    If a company name is provided, returns the count for companies that match
    (case-insensitive partial match). Otherwise returns counts for every company
    in the dataset, sorted by count descending.
    """
    try:
        args = CountByCompanyInput(company=company)
    except ValidationError as e:
        msg = e.errors()[0].get("msg", str(e))
        raise ValueError(f"Invalid input: {msg}") from e

    counts: dict[str, int] = {}
    for job in JOBS:
        name = job["company"]
        if args.company is not None:
            if args.company.lower() not in name.lower():
                continue
        counts[name] = counts.get(name, 0) + 1

    # Sort by count desc, then name
    sorted_counts = dict(sorted(counts.items(), key=lambda x: (-x[1], x[0])))

    return {
        "filter": args.company,
        "total_postings": sum(sorted_counts.values()),
        "companies": sorted_counts,
    }


@mcp.tool()
def get_job_by_id(job_id: int) -> dict[str, Any]:
    """
    Retrieve the full details of a single job posting by its numeric ID.

    Returns the complete record or raises a clear error if the ID does not exist.
    """
    try:
        args = GetJobInput(job_id=job_id)
    except ValidationError as e:
        msg = e.errors()[0].get("msg", str(e))
        raise ValueError(f"Invalid input: {msg}") from e

    for job in JOBS:
        if job["id"] == args.job_id:
            return job

    raise ValueError(
        f"No job found with id={args.job_id}. "
        f"Valid IDs are 1–{max(j['id'] for j in JOBS)}."
    )


@mcp.tool()
def list_skills() -> list[str]:
    """
    Return a sorted list of all unique skills that appear in the job postings dataset.
    Useful for discovering what skills can be searched.
    """
    skills: set[str] = set()
    for job in JOBS:
        skills.update(job.get("skills", []))
    return sorted(skills)


if __name__ == "__main__":
    # Default: stdio transport (for Claude Desktop / MCP Inspector)
    # For HTTP: mcp.run(transport="streamable-http", host="0.0.0.0", port=8000)
    mcp.run()
