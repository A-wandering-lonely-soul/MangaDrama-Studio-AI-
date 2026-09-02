interface AppConfig {
  port: number;
  corsOrigins: string[] | '*';
  nodeEnv: string;
  sqlitePath: string;
  aiProvider: 'mock' | 'aliyun';
  dashscopeApiKey: string;
  dashscopeBaseUrl: string;
  dashscopeTextModel: string;
  dashscopeImageModel: string;
}

function parsePort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port <= 0) {
    return 3000;
  }

  return port;
}

function parseCorsOrigins(value: string | undefined): string[] | '*' {
  if (!value || value.trim() === '') {
    return '*';
  }

  if (value.trim() === '*') {
    return '*';
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function getAppConfig(): AppConfig {
  const providerRaw = process.env.AI_PROVIDER?.trim().toLowerCase();
  const aiProvider: 'mock' | 'aliyun' = providerRaw === 'aliyun' ? 'aliyun' : 'mock';

  return {
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    nodeEnv: process.env.NODE_ENV?.trim() || 'development',
    sqlitePath: process.env.SQLITE_PATH?.trim() || './data/manga-drama.db',
    aiProvider,
    dashscopeApiKey: process.env.DASHSCOPE_API_KEY?.trim() || '',
    dashscopeBaseUrl: process.env.DASHSCOPE_BASE_URL?.trim() || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    dashscopeTextModel: process.env.DASHSCOPE_TEXT_MODEL?.trim() || 'qwen-plus',
    dashscopeImageModel: process.env.DASHSCOPE_IMAGE_MODEL?.trim() || 'wanx2.1-t2i-turbo'
  };
}
