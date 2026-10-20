<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';
require_once RADIO_ROOT . '/scripts/metadata.php';
ensure_storage();
json_response(['station' => 'Ty deBruyn Radio', 'syncInterval' => RADIO_SYNC_INTERVAL, 'driftThreshold' => RADIO_DRIFT_THRESHOLD, 'defaultVolume' => RADIO_DEFAULT_VOLUME, 'trackCount' => count(load_tracks())]);
