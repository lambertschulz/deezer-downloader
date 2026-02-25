import type { z } from "zod";
import { getConfig } from "@/config";

export class ApiError extends Error {
  status: number;
  body: string;

  constructor(status: number, body: string) {
    super(`API error ${status}: ${body}`);
    this.status = status;
    this.body = body;
  }
}

function getApiRoot(): string {
  return getConfig().apiRoot;
}

export async function apiGet<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(`${getApiRoot()}${path}`);
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = await res.json();
  return schema.parse(data);
}

export async function apiPost<T>(
  path: string,
  body: unknown,
  schema: z.ZodType<T>,
): Promise<T> {
  const res = await fetch(`${getApiRoot()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new ApiError(res.status, await res.text());
  const data = await res.json();
  return schema.parse(data);
}
