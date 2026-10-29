interface Config {
  port: number;
  databaseUrl: string;
  redisUrl: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  return {
    port: readPort(readRequired(env, 'PORT')),
    databaseUrl: readRequired(env, 'DATABASE_URL'),
    redisUrl: readRequired(env, 'REDIS_URL'),
  };
}

function readRequired(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function readPort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a valid port number, got "${value}"`);
  }
  return port;
}
