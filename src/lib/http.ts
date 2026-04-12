export async function safeReadJson<T = unknown>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

export async function requestJson<T = unknown>(input: RequestInfo | URL, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? "include",
  });
  const data = await safeReadJson<T>(response);
  return { response, data };
}
