<?php
declare(strict_types=1);
require_once __DIR__ . '/../api/config.php';

function load_tracks(): array {
    $tracks = [];
    foreach (glob(RADIO_AUDIO_DIR . '/*.mp3') ?: [] as $file) {
        $meta = parse_mp3($file);
        if ($meta['duration'] <= 0) continue;
        $id = hash('sha256', basename($file));
        if (is_array($meta['artwork']) && $meta['artwork']['data'] !== '') {
            $artworkFile = RADIO_ARTWORK_DIR . '/' . $id . '.jpg';
            if (!is_file($artworkFile)) @file_put_contents($artworkFile, $meta['artwork']['data'], LOCK_EX);
        }
        $tracks[] = ['id' => $id, 'file' => basename($file), 'title' => $meta['title'] ?: pathinfo($file, PATHINFO_FILENAME), 'artist' => $meta['artist'] ?: 'Ty deBruyn Radio', 'album' => $meta['album'], 'duration' => $meta['duration'], 'artwork' => is_file(RADIO_ARTWORK_DIR . '/' . $id . '.jpg')];
    }
    usort($tracks, static fn(array $a, array $b): int => strcmp($a['id'], $b['id']));
    return $tracks;
}
function parse_mp3(string $file): array {
    $handle = @fopen($file, 'rb'); if (!$handle) return ['title' => '', 'artist' => '', 'album' => '', 'duration' => 0, 'artwork' => []];
    $head = fread($handle, 10); $tags = ['title' => '', 'artist' => '', 'album' => '', 'artwork' => []];
    if (is_string($head) && substr($head, 0, 3) === 'ID3') {
        $size = id3_size(substr($head, 6, 4)); $body = $size > 0 ? fread($handle, $size) : '';
        if (is_string($body)) for ($p = 0; $p + 10 <= strlen($body); $p += 10) {
            $id = substr($body, $p, 4); $length = unpack('N', substr($body, $p + 4, 4))[1] ?? 0; if ($length <= 0 || $p + 10 + $length > strlen($body)) break;
            $value = substr($body, $p + 10, $length);
            if (in_array($id, ['TIT2', 'TPE1', 'TALB'], true)) {
                $text = substr($value, 1);
                $tags[['TIT2' => 'title', 'TPE1' => 'artist', 'TALB' => 'album'][$id]] = trim(function_exists('mb_convert_encoding') ? mb_convert_encoding($text, 'UTF-8', 'UTF-8, ISO-8859-1') : $text);
            }
            if ($id === 'APIC' && $tags['artwork'] === []) {
                $mimeEnd = strpos($value, "\0", 1);
                if ($mimeEnd !== false) {
                    $descriptionStart = $mimeEnd + 2;
                    $descriptionEnd = strpos($value, "\0", $descriptionStart);
                    if ($descriptionEnd !== false) $tags['artwork'] = ['data' => substr($value, $descriptionEnd + 1)];
                }
            }
        }
    }
    fclose($handle);
    $size = filesize($file) ?: 0; $duration = 0; $rate = 128000; if ($size > 0) $duration = max(1, $size * 8 / $rate);
    return array_merge($tags, ['duration' => $duration]);
}
function id3_size(string $bytes): int { if (strlen($bytes) !== 4) return 0; return (ord($bytes[0]) << 21) | (ord($bytes[1]) << 14) | (ord($bytes[2]) << 7) | ord($bytes[3]); }
