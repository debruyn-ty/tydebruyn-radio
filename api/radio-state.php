<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once RADIO_ROOT . '/scripts/metadata.php';

ensure_storage();
$tracks = load_tracks();
$fingerprint = hash('sha256', json_encode(array_map(static fn(array $t): array => [$t['id'], $t['duration']], $tracks)));
$now = microtime(true);
$lock = fopen(RADIO_STATE_FILE . '.lock', 'c+');
if ($lock === false || !flock($lock, LOCK_EX)) json_response(['error' => 'Radio state is unavailable.'], 503);
$raw = is_file(RADIO_STATE_FILE) ? file_get_contents(RADIO_STATE_FILE) : false;
$state = is_string($raw) ? json_decode($raw, true) : null;
if (!is_array($state) || ($state['fingerprint'] ?? '') !== $fingerprint || count($tracks) === 0) {
    $order = array_keys($tracks);
    shuffle($order);
    $state = ['version' => gmdate('YmdHis'), 'fingerprint' => $fingerprint, 'order' => $order, 'startAt' => $now];
    $encoded = json_encode($state, JSON_UNESCAPED_SLASHES);
    $temp = RADIO_STATE_FILE . '.tmp.' . bin2hex(random_bytes(5));
    if (file_put_contents($temp, $encoded, LOCK_EX) === false || !rename($temp, RADIO_STATE_FILE)) {
        @unlink($temp); flock($lock, LOCK_UN); fclose($lock); json_response(['error' => 'Unable to save radio state.'], 500);
    }
}
flock($lock, LOCK_UN); fclose($lock);
if (!$tracks) json_response(['serverTime' => (int) round($now * 1000), 'track' => null, 'message' => 'No MP3 files have been added yet.']);
$elapsed = max(0, $now - (float) $state['startAt']);
$total = array_sum(array_map(static fn(int $i): float => $tracks[$i]['duration'], $state['order']));
$elapsed = $total > 0 ? fmod($elapsed, $total) : 0;
$cursor = 0.0; $index = $state['order'][0];
foreach ($state['order'] as $candidate) {
    if ($elapsed < $cursor + $tracks[$candidate]['duration']) { $index = $candidate; break; }
    $cursor += $tracks[$candidate]['duration'];
}
$track = $tracks[$index];
$track['url'] = RADIO_BASE_URL . rawurlencode($track['file']);
$track['artwork'] = $track['artwork'] ? RADIO_ARTWORK_URL . rawurlencode($track['id'] . '.jpg') : null;
json_response(['serverTime' => (int) round($now * 1000), 'version' => $state['version'], 'trackStartAt' => (int) round(($now - ($elapsed - $cursor)) * 1000), 'track' => $track]);
