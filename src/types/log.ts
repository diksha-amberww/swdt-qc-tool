export type LogLevel = 'ALL' | 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';

export type LogCategory = 
  | 'SYSTEM' 
  | 'LOGIN' 
  | 'SCRAPER' 
  | 'AMAZON_API' 
  | 'QC_ENGINE' 
  | 'AI_CALL' 
  | 'ERROR';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  category: LogCategory;
  sku?: string;
  asin?: string;
  message: string;
  details?: Record<string, any> | string;
}
