import jobsData from "./jobs.json";

export type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  skills: string[];
  salary_min: number;
  salary_max: number;
  description: string;
  posted_at: string;
};

const JOBS = jobsData as Job[];

export const toolDefinitions = [
  {
    name: "search_postings_by_skill",
    description:
      "Search job postings that require a given skill. Matches are case-insensitive. Returns matching postings with id, title, company, location, skills and salary range.",
    parameters: {
      type: "object",
      properties: {
        skill: {
          type: "string",
          description: "Skill to search for (e.g. 'Python', 'React')",
        },
        limit: {
          type: "integer",
          description: "Max number of results (1-50). Default 10.",
        },
        remote_only: {
          type: "boolean",
          description: "If true, only return remote postings. Default false.",
        },
      },
      required: ["skill"],
    },
  },
  {
    name: "count_postings_by_company",
    description:
      "Count job postings grouped by company. Optional company name filter (partial, case-insensitive).",
    parameters: {
      type: "object",
      properties: {
        company: {
          type: "string",
          description:
            "Optional company name filter. Omit to get counts for all companies.",
        },
      },
      required: [],
    },
  },
  {
    name: "get_job_by_id",
    description: "Retrieve the full details of a single job posting by numeric ID.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "integer",
          description: "Numeric job ID (1 or higher)",
        },
      },
      required: ["job_id"],
    },
  },
  {
    name: "list_skills",
    description:
      "Return a sorted list of all unique skills that appear in the dataset.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

export function executeTool(
  name: string,
  args: Record<string, unknown>
): unknown {
  switch (name) {
    case "search_postings_by_skill": {
      const skill = String(args.skill ?? "").trim();
      if (!skill) throw new Error("skill must not be empty");
      let limit = Number(args.limit ?? 10);
      if (isNaN(limit) || limit < 1 || limit > 50) {
        throw new Error("limit must be an integer between 1 and 50");
      }
      const remoteOnly = Boolean(args.remote_only ?? false);
      const skillLower = skill.toLowerCase();
      const matches: Partial<Job>[] = [];
      for (const job of JOBS) {
        const skills = job.skills.map((s) => s.toLowerCase());
        if (
          skills.includes(skillLower) ||
          skills.some((s) => s.includes(skillLower))
        ) {
          if (remoteOnly && !job.remote) continue;
          matches.push({
            id: job.id,
            title: job.title,
            company: job.company,
            location: job.location,
            remote: job.remote,
            skills: job.skills,
            salary_min: job.salary_min,
            salary_max: job.salary_max,
            posted_at: job.posted_at,
          });
          if (matches.length >= limit) break;
        }
      }
      return matches;
    }

    case "count_postings_by_company": {
      const company =
        args.company != null ? String(args.company).trim() || null : null;
      const counts: Record<string, number> = {};
      for (const job of JOBS) {
        if (
          company &&
          !job.company.toLowerCase().includes(company.toLowerCase())
        ) {
          continue;
        }
        counts[job.company] = (counts[job.company] || 0) + 1;
      }
      const sorted = Object.fromEntries(
        Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      );
      return {
        filter: company,
        total_postings: Object.values(sorted).reduce((a, b) => a + b, 0),
        companies: sorted,
      };
    }

    case "get_job_by_id": {
      const jobId = Number(args.job_id);
      if (!Number.isInteger(jobId) || jobId < 1) {
        throw new Error("job_id must be a positive integer");
      }
      const job = JOBS.find((j) => j.id === jobId);
      if (!job) {
        throw new Error(
          `No job found with id=${jobId}. Valid IDs are 1–${Math.max(...JOBS.map((j) => j.id))}.`
        );
      }
      return job;
    }

    case "list_skills": {
      const skills = new Set<string>();
      for (const job of JOBS) {
        job.skills.forEach((s) => skills.add(s));
      }
      return Array.from(skills).sort();
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
