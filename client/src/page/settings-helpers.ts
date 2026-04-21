import { ConfigWrapper } from "@rin/config";
import { client, endpoint } from "../app/runtime";
import { defaultClientConfig, defaultServerConfig } from "../state/config";
import { headersWithAuth } from "../utils/auth";
import { t } from "../i18n";

export type ImportMessage = { title: string; reason: string };
export type SettingsDraft = {
  clientConfig: Record<string, unknown>;
  serverConfig: Record<string, unknown>;
};
export type SettingsLoadState = {
  draft: SettingsDraft;
};

export function mergeSessionConfig(updates: Record<string, unknown>) {
  const currentConfig = sessionStorage.getItem("config");
  const parsedConfig = currentConfig ? JSON.parse(currentConfig) : {};
  sessionStorage.setItem("config", JSON.stringify({ ...parsedConfig, ...updates }));
}

export async function loadSettingsConfigState() {
  const response = await client.config.getAll();
  return normalizeSettingsState(response.data);
}

export async function saveSettingsConfigState(draft: SettingsDraft) {
  const response = await client.config.updateAll(draft);
  return normalizeSettingsState(response.data);
}

export function normalizeSettingsState(
  data: SettingsDraft | null | undefined,
): SettingsLoadState {
  const clientConfig = { ...(data?.clientConfig ?? {}) };
  const serverConfig = { ...(data?.serverConfig ?? {}) };

  return {
    draft: {
      clientConfig,
      serverConfig,
    },
  };
}

export function createSettingsConfigWrappers(draft: SettingsDraft) {
  return {
    clientConfig: new ConfigWrapper(draft.clientConfig, defaultClientConfig),
    serverConfig: new ConfigWrapper(draft.serverConfig, defaultServerConfig),
  };
}

export async function uploadFavicon(file: File, showAlert: (message: string) => void) {
  const maxFileSize = 10 * 1024 * 1024;
  if (file.size > maxFileSize) {
    showAlert(t("upload.failed$size", { size: maxFileSize / 1024 / 1024 }));
    return;
  }

  const formData = new FormData();
  formData.append("file", file);
  const response = await fetch(`${endpoint}/api/favicon`, {
    method: "POST",
    headers: headersWithAuth(),
    body: formData,
    credentials: "include",
  });

  if (response.ok) {
    showAlert(t("settings.favicon.update.success"));
    return;
  }

  showAlert(
    t("settings.favicon.update.failed$message", {
      message: response.statusText,
    }),
  );
}

export async function importWordPressFile(file: File) {
  const xmlContent = await file.text();
  return client.wp.import(xmlContent);
}

export function updateDraftConfig(
  draft: SettingsDraft,
  type: "client" | "server",
  key: string,
  value: unknown,
): SettingsDraft {
  return {
    ...draft,
    [type === "client" ? "clientConfig" : "serverConfig"]: {
      ...draft[type === "client" ? "clientConfig" : "serverConfig"],
      [key]: value,
    },
  };
}

export function areSettingsDraftsEqual(left: SettingsDraft, right: SettingsDraft) {
  return JSON.stringify(left) === JSON.stringify(right);
}
