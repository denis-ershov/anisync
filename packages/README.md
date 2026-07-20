# packages/

Платформенные пакеты (`db`, `config`, `feature-flags`, `observability`) выносятся сюда **только при реальной нужде**:

- появился второй TypeScript-потребитель вне `apps/web`, или
- циклические импорты внутри web мешают сборке.

До этого код живёт в `apps/web/src/lib/*`.  
Доменные модули (`anime`, `releases`, `torrents`) **не** выносятся в packages — см. [MODULE_CONTRACT.md](../docs/MODULE_CONTRACT.md).

Workspace glob: `packages/*` уже в `pnpm-workspace.yaml`.
