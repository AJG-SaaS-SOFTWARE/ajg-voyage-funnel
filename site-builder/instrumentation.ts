import { recordNextRuntimeError } from "./lib/runtime-error-health";

export async function onRequestError(
  error: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routePath: string;
    routeType: string;
  }
) {
  await recordNextRuntimeError(error, request, context);
}
