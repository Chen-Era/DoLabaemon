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

type RequestJsonInit = RequestInit & {
  timeoutMs?: number;
};

export function isRequestTimeoutError(error: unknown) {
  return error instanceof Error && error.message === "REQUEST_TIMEOUT";
}

export async function requestJson<T = unknown>(input: RequestInfo | URL, init?: RequestJsonInit) {
  const { timeoutMs, signal, ...restInit } = init ?? {};
  const controller = timeoutMs ? new AbortController() : null;
  const timeoutId =
    controller && timeoutMs
      ? setTimeout(() => {
          controller.abort("REQUEST_TIMEOUT");
        }, timeoutMs)
      : null;

  if (controller && signal) {
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }

  let response: Response;
  try {
    response = await fetch(input, {
      ...restInit,
      signal: controller?.signal ?? signal,
      credentials: init?.credentials ?? "include",
    });
  } catch (error) {
    if (controller?.signal.aborted && controller.signal.reason === "REQUEST_TIMEOUT") {
      throw new Error("REQUEST_TIMEOUT");
    }
    throw error;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
  const data = await safeReadJson<T>(response);
  return { response, data };
}
