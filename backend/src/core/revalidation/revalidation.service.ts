import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom, catchError, of, timeout } from 'rxjs';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';

export type TRevalidateReason =
  | 'article.create'
  | 'article.update'
  | 'article.delete'
  | 'liveblog.update'
  | 'category.update'
  | 'menu.update';

@Injectable()
export class RevalidationService {
  constructor(
    private readonly _config: ConfigService,
    private readonly _http: HttpService,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly _logger: Logger,
  ) {}

  /**
   * Fire-and-forget cache invalidation for all configured reader deployments.
   * Never throws. Logs failures so they're visible but never blocks the caller.
   */
  async emit(paths: string[], reason: TRevalidateReason): Promise<void> {
    if (!paths || paths.length === 0) return;

    const targets = this._getTargets();
    const secret = this._config.get<string>('REVALIDATE_SECRET');

    if (targets.length === 0 || !secret) {
      this._logger.debug(
        `[Revalidation] Skipped emit (targets=${targets.length}, secretSet=${!!secret}) reason=${reason}`,
        this.constructor.name,
      );
      return;
    }

    await Promise.allSettled(
      targets.map((url) => this._postToTarget(url, paths, secret, reason)),
    );
  }

  private _getTargets(): string[] {
    const raw = this._config.get<string>('REVALIDATE_TARGETS') || '';
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
  }

  private async _postToTarget(
    baseUrl: string,
    paths: string[],
    secret: string,
    reason: TRevalidateReason,
  ): Promise<void> {
    const url = `${baseUrl.replace(/\/$/, '')}/api/revalidate`;
    const start = Date.now();

    try {
      const res$ = this._http
        .post(
          url,
          { paths, secret },
          { headers: { 'Content-Type': 'application/json' } },
        )
        .pipe(
          timeout(5000),
          catchError((err) => {
            this._logger.warn(
              `[Revalidation] target=${url} reason=${reason} paths=${paths.length} ERROR: ${err?.message || err}`,
              this.constructor.name,
            );
            return of(null);
          }),
        );

      const res = await firstValueFrom(res$);
      if (res) {
        this._logger.log(
          `[Revalidation] target=${url} reason=${reason} paths=${paths.length} status=${res.status} in=${Date.now() - start}ms`,
          this.constructor.name,
        );
      }
    } catch (err) {
      this._logger.warn(
        `[Revalidation] unexpected error target=${url}: ${(err as Error)?.message}`,
        this.constructor.name,
      );
    }
  }
}
