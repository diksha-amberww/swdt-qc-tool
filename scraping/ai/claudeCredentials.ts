import { readProjectEnv } from '../../shared/envUtils';
import type { ClaudeCredentials } from './claudeQcComparator';

/** Anthropic API alias for Claude Haiku 4.5 (hyphen, not dot). */
export const DEFAULT_CLAUDE_MODEL = 'claude-haiku-4-5';

/** Map known bad / marketing-style IDs to a valid Claude API model id. */
export function normalizeClaudeModelId(model?: string | null): string {
  const raw = (model || '').trim();
  if (!raw) return DEFAULT_CLAUDE_MODEL;
  if (raw === 'claude-haiku-4.5' || raw === 'claude-haiku-4.5-20251001') {
    return DEFAULT_CLAUDE_MODEL;
  }
  return raw;
}

export function resolveClaudeCredentials(cwd?: string): ClaudeCredentials {
  const env = readProjectEnv(cwd);
  return {
    apiKey: env.ANTHROPIC_API_KEY || '',
    model: normalizeClaudeModelId(env.ANTHROPIC_MODEL),
    endpointUrl: env.ANTHROPIC_ENDPOINT || 'https://api.anthropic.com/v1/messages',
  };
}
