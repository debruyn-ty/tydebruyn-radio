<?php
declare(strict_types=1);

const RADIO_ROOT = __DIR__ . '/..';
const RADIO_AUDIO_DIR = RADIO_ROOT . '/audio';
const RADIO_PRIVATE_DIR = RADIO_ROOT . '/private';
const RADIO_STATE_FILE = RADIO_PRIVATE_DIR . '/state.json';
const RADIO_CACHE_DIR = RADIO_PRIVATE_DIR . '/metadata';
const RADIO_ARTWORK_DIR = RADIO_ROOT . '/radio/assets/artwork';
const RADIO_BASE_URL = '../audio/';
const RADIO_ARTWORK_URL = '../radio/assets/artwork/';
const RADIO_SYNC_INTERVAL = 20;
const RADIO_DRIFT_THRESHOLD = 1.5;
const RADIO_DEFAULT_VOLUME = 0.8;

function json_response(array $payload, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate');
    echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    exit;
}
function ensure_storage(): void {
    foreach ([RADIO_PRIVATE_DIR, RADIO_CACHE_DIR, RADIO_ARTWORK_DIR] as $dir) {
        if (!is_dir($dir) && !mkdir($dir, 0750, true) && !is_dir($dir)) {
            json_response(['error' => 'Radio storage is not writable.'], 500);
        }
    }
}
