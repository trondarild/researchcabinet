export interface RegistryTemplate {
  slug: string;
  name: string;
  description: string;
  domain: string;
  agentCount: number;
  jobCount: number;
  childCount: number;
}

// Registry templates are fetched from a remote GitHub repo (see src/lib/registry/github-fetch.ts).
// Add entries here only when matching template directories exist in that repo.
export const REGISTRY_TEMPLATES: RegistryTemplate[] = [];
