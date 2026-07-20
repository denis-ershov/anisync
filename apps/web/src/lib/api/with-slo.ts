import type { NextRequest } from 'next/server';

import { createLogger } from '@/lib/observability/logger';
import { observeApiRequest } from '@/lib/observability/slo-metrics';

const log = createLogger('api:slo');
const SLOW_MS = Number(process.env.API_SLOW_REQUEST_MS ?? 1500);

export type SloRouteContext = { params: Promise<Record<string, string>> };

type SimpleRouteHandler = (request: NextRequest) => Promise<Response>;
type ContextRouteHandler = (request: NextRequest, context: SloRouteContext) => Promise<Response>;

function observeRoute(path: string, request: NextRequest, startedAt: number, statusCode: number) {
  const elapsedMs = performance.now() - startedAt;
  observeApiRequest(path, elapsedMs, statusCode);

  if (elapsedMs > SLOW_MS) {
    log.warn(
      {
        path,
        method: request.method,
        elapsedMs: Math.round(elapsedMs),
        statusCode,
      },
      'Slow API request'
    );
  }
}

export function withSloRoute(path: string, handler: SimpleRouteHandler): SimpleRouteHandler;
export function withSloRoute(path: string, handler: ContextRouteHandler): ContextRouteHandler;
export function withSloRoute(
  path: string,
  handler: SimpleRouteHandler | ContextRouteHandler
): SimpleRouteHandler | ContextRouteHandler {
  if (handler.length >= 2) {
    const contextHandler = handler as ContextRouteHandler;
    return async (request: NextRequest, context: SloRouteContext) => {
      const startedAt = performance.now();
      let statusCode = 500;

      try {
        const response = await contextHandler(request, context);
        statusCode = response.status;
        return response;
      } catch (error) {
        statusCode = 500;
        throw error;
      } finally {
        observeRoute(path, request, startedAt, statusCode);
      }
    };
  }

  const simpleHandler = handler as SimpleRouteHandler;
  return async (request: NextRequest) => {
    const startedAt = performance.now();
    let statusCode = 500;

    try {
      const response = await simpleHandler(request);
      statusCode = response.status;
      return response;
    } catch (error) {
      statusCode = 500;
      throw error;
    } finally {
      observeRoute(path, request, startedAt, statusCode);
    }
  };
}
