import { readProjectEnv } from '../../shared/envUtils';
import type { ClaudeCredentials } from '../compare/titleAiComparator';

export function resolveClaudeCredentials(cwd?: string): ClaudeCredentials {
  const env = readProjectEnv(cwd);
  return {
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: env.ANTHROPIC_MODEL || 'claude-haiku-4.5',
    endpointUrl: env.ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
  };
}
