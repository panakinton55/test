import type { Destination } from './guard/schema.js';

export function upstreamsFromEnv(env: NodeJS.ProcessEnv = process.env): Partial<Record<Destination, string>> {
  const upstreams: Partial<Record<Destination, string>> = {};
  if (env.UPSTREAM_LLM_URL) upstreams['llm.completions'] = env.UPSTREAM_LLM_URL;
  if (env.UPSTREAM_SEARCH_URL) upstreams['search.query'] = env.UPSTREAM_SEARCH_URL;
  if (env.UPSTREAM_TOOLS_URL) upstreams['tools.invoke'] = env.UPSTREAM_TOOLS_URL;
  return upstreams;
}
