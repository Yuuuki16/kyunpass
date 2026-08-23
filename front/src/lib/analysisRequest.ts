// Chatbot kicks off the /analyze request just before navigating to the
// loading screen, and its component unmounts on that navigation while the
// request keeps running in the background. This module-level handle is how
// the (separately mounted) loading screen can still cancel that in-flight
// request.
let activeController: AbortController | null = null;

export function beginAnalysisRequest(): AbortController {
  const controller = new AbortController();
  activeController = controller;
  return controller;
}

export function endAnalysisRequest(controller: AbortController): void {
  if (activeController === controller) {
    activeController = null;
  }
}

export function cancelAnalysisRequest(): void {
  activeController?.abort();
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}
