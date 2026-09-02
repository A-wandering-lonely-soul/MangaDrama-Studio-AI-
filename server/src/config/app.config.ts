interface AppConfig {
  port: number;
  corsOrigins: string[] | '*';
  nodeEnv: string;
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
  return {
    port: parsePort(process.env.PORT),
    corsOrigins: parseCorsOrigins(process.env.CORS_ORIGIN),
    nodeEnv: process.env.NODE_ENV?.trim() || 'development'
  };
}
