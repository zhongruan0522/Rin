type HealthStatus = "success" | "warning" | "danger";
type HealthTextValues = Record<string, string | number | boolean>;

export interface HealthText {
  key: string;
  values?: HealthTextValues;
}

export interface HealthCheckItem {
  id: string;
  title: HealthText;
  status: HealthStatus;
  configured: boolean;
  impact: HealthText;
  summary: HealthText;
  suggestion?: HealthText;
  details?: HealthText[];
}

export interface HealthCheckResponse {
  generatedAt: string;
  summary: Record<HealthStatus, number>;
  items: HealthCheckItem[];
}

function createItem(item: HealthCheckItem): HealthCheckItem {
  return item;
}

function text(key: string, values?: HealthTextValues): HealthText {
  return values ? { key, values } : { key };
}

export async function buildHealthCheckResponse(
  clientConfig: { get: (key: string) => Promise<any>; getOrDefault: <T>(key: string, defaultValue: T) => Promise<T> },
  serverConfig: { get: (key: string) => Promise<any>; getOrDefault: <T>(key: string, defaultValue: T) => Promise<T> },
  env: Env,
): Promise<HealthCheckResponse> {
  const [
    loginEnabled,
    siteName,
    siteAvatar,
    friendCrontab,
  ] = await Promise.all([
    clientConfig.getOrDefault("login.enabled", true),
    clientConfig.get("site.name"),
    clientConfig.get("site.avatar"),
    serverConfig.getOrDefault("friend_crontab", true),
  ]);

  const items: HealthCheckItem[] = [];
  const passwordReady = Boolean(env.ADMIN_USERNAME && env.ADMIN_PASSWORD);
  const defaultPasswordInUse =
    env.ADMIN_USERNAME === "admin" && env.ADMIN_PASSWORD === "admin123";
  const jwtReady = Boolean(env.JWT_SECRET);

  items.push(
    createItem(
      jwtReady
        ? {
            id: "auth-runtime",
            title: text("health.items.auth_runtime.title"),
            status: "success",
            configured: true,
            impact: text("health.items.auth_runtime.success.impact"),
            summary: text("health.items.auth_runtime.success.summary"),
            suggestion: text("health.items.auth_runtime.success.suggestion"),
          }
        : {
            id: "auth-runtime",
            title: text("health.items.auth_runtime.title"),
            status: "danger",
            configured: false,
            impact: text("health.items.auth_runtime.danger.impact"),
            summary: text("health.items.auth_runtime.danger.summary"),
            suggestion: text("health.items.auth_runtime.danger.suggestion"),
          },
    ),
  );

  if (!loginEnabled) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "warning",
        configured: false,
        impact: text("health.items.login_methods.disabled.impact"),
        summary: text("health.items.login_methods.disabled.summary"),
        suggestion: text("health.items.login_methods.disabled.suggestion"),
      }),
    );
  } else if (!passwordReady) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "danger",
        configured: false,
        impact: text("health.items.login_methods.missing.impact"),
        summary: text("health.items.login_methods.missing.summary"),
        suggestion: text("health.items.login_methods.missing.suggestion"),
      }),
    );
  } else if (defaultPasswordInUse) {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "danger",
        configured: false,
        impact: text("health.items.login_methods.default_password.impact"),
        summary: text("health.items.login_methods.default_password.summary"),
        suggestion: text("health.items.login_methods.default_password.suggestion"),
        details: [
          text("health.items.login_methods.details.password_default"),
        ],
      }),
    );
  } else {
    items.push(
      createItem({
        id: "login-methods",
        title: text("health.items.login_methods.title"),
        status: "success",
        configured: true,
        impact: text("health.items.login_methods.ready.impact"),
        summary: text("health.items.login_methods.ready.summary"),
        suggestion: text("health.items.login_methods.ready.suggestion"),
      }),
    );
  }

  const usesR2Binding = Boolean(env.R2_BUCKET);
  const requiredStorageKeys = usesR2Binding
    ? ([] as const)
    : ([
        ["S3_ENDPOINT", env.S3_ENDPOINT],
        ["S3_BUCKET", env.S3_BUCKET],
        ["S3_ACCESS_KEY_ID", env.S3_ACCESS_KEY_ID],
        ["S3_SECRET_ACCESS_KEY", env.S3_SECRET_ACCESS_KEY],
      ] as const);
  const missingStorageKeys = requiredStorageKeys.filter(([, value]) => !value).map(([key]) => key);
  const hasAccessHost = Boolean(env.S3_ACCESS_HOST);

  if (missingStorageKeys.length === 0) {
    items.push(
      createItem({
        id: "storage",
        title: text("health.items.storage.title"),
        status: "success",
        configured: true,
        impact: text("health.items.storage.ready.impact"),
        summary: text("health.items.storage.ready.summary"),
        suggestion: text("health.items.common.no_action"),
      }),
    );
  } else {
    items.push(
      createItem({
        id: "storage",
        title: text("health.items.storage.title"),
        status: missingStorageKeys.length === requiredStorageKeys.length ? "warning" : "danger",
        configured: false,
        impact: text("health.items.storage.missing.impact"),
        summary:
          missingStorageKeys.length === requiredStorageKeys.length
            ? text("health.items.storage.missing.summary_none")
            : text("health.items.storage.missing.summary_partial", { keys: missingStorageKeys.join(", ") }),
        suggestion: text("health.items.storage.missing.suggestion"),
        details: missingStorageKeys.map((key) => text("health.items.storage.details.key", { key })),
      }),
    );
  }

  const finalSiteName = String(siteName || "").trim();
  const finalSiteAvatar = String(siteAvatar || "").trim();
  items.push(
    createItem(
      finalSiteName
        ? {
            id: "site-identity",
            title: text("health.items.site_identity.title"),
            status: finalSiteAvatar ? "success" : "warning",
            configured: true,
            impact: text("health.items.site_identity.ready.impact"),
            summary: finalSiteAvatar
              ? text("health.items.site_identity.ready.summary", { name: finalSiteName })
              : text("health.items.site_identity.ready.summary_missing_avatar", { name: finalSiteName }),
            suggestion: finalSiteAvatar
              ? text("health.items.common.no_action")
              : text("health.items.site_identity.ready.suggestion_missing_avatar"),
          }
        : {
            id: "site-identity",
            title: text("health.items.site_identity.title"),
            status: "warning",
            configured: false,
            impact: text("health.items.site_identity.missing.impact"),
            summary: text("health.items.site_identity.missing.summary"),
            suggestion: text("health.items.site_identity.missing.suggestion"),
          },
    ),
  );

  const summary = items.reduce(
    (result, item) => {
      result[item.status] += 1;
      return result;
    },
    { success: 0, warning: 0, danger: 0 } as Record<HealthStatus, number>,
  );

  return {
    generatedAt: new Date().toISOString(),
    summary,
    items,
  };
}
