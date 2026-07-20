# Dual-write cutover (архив)

> Статус: `not applicable` для greenfield.

Python bridge, `ANISYNC_INTERNAL_URL` и `/api/internal/torrents/notify` удалены.
Telegram и in-app notifications создаёт один `TorrentWatcherService`, работающий с
AniSync `torrent_*`.

Rollback выполняется redeploy предыдущего AniSync image и restore backup; legacy
NightWatcher не является rollback path.
