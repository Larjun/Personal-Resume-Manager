/**
 * Tag normalization. Every tag is normalized before it's saved, so the same
 * tag is never stored twice under different spellings: whitespace is
 * collapsed, known aliases map to one canonical spelling (ts → TypeScript),
 * and duplicates are dropped ignoring case.
 */

export const MAX_TAG_LENGTH = 40;
export const MAX_TAGS = 50;

/** Canonical spelling → other ways people write it. Lookup ignores case. */
const CANONICAL: Record<string, string[]> = {
  // Languages
  TypeScript: ["ts"],
  JavaScript: ["js", "ecmascript"],
  Python: ["py", "python3"],
  Go: ["golang"],
  Java: [],
  "C++": ["cpp", "cplusplus"],
  "C#": ["csharp", "c sharp"],
  C: [],
  Swift: [],
  Kotlin: [],
  Rust: [],
  Ruby: [],
  SQL: [],
  HTML: ["html5"],
  CSS: ["css3"],
  // Frameworks and libraries
  React: ["reactjs", "react.js"],
  "React Native": ["rn", "reactnative"],
  "Next.js": ["next", "nextjs"],
  "Node.js": ["node", "nodejs"],
  Express: ["expressjs", "express.js"],
  Vue: ["vuejs", "vue.js"],
  Angular: ["angularjs"],
  Django: [],
  Flask: [],
  "Spring Boot": ["springboot", "spring"],
  "Tailwind CSS": ["tailwind", "tailwindcss"],
  "Material UI": ["mui", "material-ui"],
  GraphQL: ["gql"],
  TensorFlow: ["tf"],
  PyTorch: ["torch"],
  "Core ML": ["coreml"],
  // Data and infrastructure
  PostgreSQL: ["postgres", "psql", "pg"],
  MySQL: [],
  MongoDB: ["mongo"],
  Redis: [],
  Supabase: [],
  Kubernetes: ["k8s", "kube"],
  Docker: [],
  AWS: ["amazon web services"],
  "Google Cloud": ["gcp", "google cloud platform"],
  Azure: ["microsoft azure"],
  Terraform: [],
  "CI/CD": ["cicd", "ci-cd", "ci cd"],
  "REST APIs": ["rest", "rest api", "restful", "restful apis", "apis"],
  // Roles and practices
  "Full-stack": ["fullstack", "full stack"],
  Frontend: ["front-end", "front end"],
  Backend: ["back-end", "back end"],
  DevOps: [],
  iOS: [],
  Android: [],
  "Machine Learning": ["ml"],
  "Data Pipelines": ["data pipeline"],
  ETL: [],
  "Distributed Systems": ["distributed system"],
};

const ALIASES: Map<string, string> = new Map(
  Object.entries(CANONICAL).flatMap(([canonical, aliases]) =>
    [canonical, ...aliases].map((a) => [a.toLowerCase(), canonical] as const),
  ),
);

/** Trims, collapses whitespace and applies the alias map. Returns "" for a blank tag. */
export function normalizeTag(raw: string): string {
  const tag = raw.trim().replace(/\s+/g, " ").slice(0, MAX_TAG_LENGTH).trim();
  return ALIASES.get(tag.toLowerCase()) ?? tag;
}

/** Normalizes each tag, drops blanks and case-insensitive duplicates (the first spelling wins). */
export function normalizeTags(raw: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of raw) {
    const tag = normalizeTag(r);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length === MAX_TAGS) break;
  }
  return out;
}

/**
 * The spelling to store for a typed tag: the alias map first, then an existing
 * tag that matches ignoring case, so "python" reuses "Python" and "sim racing"
 * reuses "Sim Racing" instead of starting a second spelling.
 */
export function resolveTag(raw: string, existing: readonly string[]): string {
  const tag = normalizeTag(raw);
  return existing.find((t) => t.toLowerCase() === tag.toLowerCase()) ?? tag;
}
