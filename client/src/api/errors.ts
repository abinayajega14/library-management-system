import axios from "axios";

export interface ApiErrorDetails {
  message: string;
  errors: Record<string, string>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getApiError(error: unknown): ApiErrorDetails {
  const data: unknown = axios.isAxiosError(error) ? error.response?.data : undefined;
  const fieldErrors: Record<string, string> = {};

  if (isRecord(data) && isRecord(data.errors)) {
    for (const [field, message] of Object.entries(data.errors)) {
      if (typeof message === "string") {
        fieldErrors[field] = message;
      }
    }
  }

  if (isRecord(data) && typeof data.message === "string") {
    return { message: data.message, errors: fieldErrors };
  }

  return {
    message: error instanceof Error ? error.message : "The request could not be completed.",
    errors: fieldErrors,
  };
}
