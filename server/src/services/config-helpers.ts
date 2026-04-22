import {
  CLIENT_CONFIG_ENV_DEFAULTS,
} from "@rin/config";

type ConfigMapLike = {
  all(): Promise<Map<string, unknown>>;
  set(key: string, value: unknown, save?: boolean): Promise<void>;
  save(): Promise<void>;
};

type ConfigReaderLike = {
  get(key: string): Promise<unknown>;
};

type ConfigProfiler = <T>(name: string, task: () => Promise<T>) => Promise<T>;

export type ConfigTypeParam = "client" | "server";

export function isConfigType(type: string): type is ConfigTypeParam {
  return type === "client" || type === "server";
}

export function maskSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  return config;
}

export function splitConfigPayload(body: Record<string, unknown>) {
  return { regularConfig: body };
}

export async function persistRegularConfig(
  config: ConfigMapLike,
  updates: Record<string, unknown>,
) {
  for (const key in updates) {
    await config.set(key, updates[key], false);
  }
  await config.save();
}

export async function getClientConfigWithDefaults(
  clientConfig: ConfigMapLike,
  env: Env,
  profile?: ConfigProfiler,
): Promise<Record<string, unknown>> {
  const all = profile
    ? await profile("client_config_all", () => clientConfig.all())
    : await clientConfig.all();
  const result: Record<string, unknown> = Object.fromEntries(all);

  for (const [configKey, envKey] of Object.entries(CLIENT_CONFIG_ENV_DEFAULTS)) {
    if (result[configKey] === undefined || result[configKey] === "") {
      const envValue = env[envKey as keyof Env];
      if (envValue) {
        result[configKey] = envValue;
      }
    }
  }

  if (result["site.page_size"] === undefined || result["site.page_size"] === "") {
    result["site.page_size"] = 5;
  }

  return result;
}

export async function buildServerConfigResponse(
  serverConfig: ConfigMapLike,
) {
  const all = await serverConfig.all();
  const configObj = Object.fromEntries(all);

  return maskSensitiveFields(configObj);
}

export async function buildClientConfigResponse(
  clientConfig: ConfigMapLike,
  _serverConfig: ConfigReaderLike,
  env: Env,
  profile?: ConfigProfiler,
) {
  const clientConfigData = profile
    ? await profile("client_config_defaults", () => getClientConfigWithDefaults(clientConfig, env, profile))
    : await getClientConfigWithDefaults(clientConfig, env);

  return clientConfigData;
}

export async function buildCombinedConfigResponse(
  clientConfig: ConfigMapLike,
  serverConfig: ConfigMapLike & ConfigReaderLike,
  env: Env,
) {
  const [clientConfigData, serverConfigData] = await Promise.all([
    buildClientConfigResponse(clientConfig, serverConfig, env),
    buildServerConfigResponse(serverConfig),
  ]);

  return {
    clientConfig: clientConfigData,
    serverConfig: serverConfigData,
  };
}
