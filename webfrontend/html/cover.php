<?php
ini_set('display_errors', '0');
error_reporting(0);
// cover.php — Serve the album cover of a zone
//
// The AudioServer resizes, sets an ETag and caches by itself
// (GET /api/v1/zones/<id>/cover?size=<width>), so this is a proxy in front of
// it: it keeps the plugin's own URL shape stable for existing callers, hides
// the AudioServer host from the browser, and falls back to a default image
// when a zone plays nothing.

require_once "loxberry_system.php";

// ── GET parameters ────────────────────────────────────────────
$zone_id = isset($_GET['zone']) ? intval($_GET['zone']) : null;
$size    = isset($_GET['size']) ? trim($_GET['size'])   : '500x500';

// ── Size parsing ───────────────────────────────────────────────
// Historic callers pass 500x500, 500x, x500 or 500. The AudioServer takes a
// single number, so everything collapses to a width.
function parse_width($size)
{
    if (preg_match('/^(\d+)x(\d+)$/', $size, $m)) return (int)$m[1];
    if (preg_match('/^(\d+)x$/',      $size, $m)) return (int)$m[1];
    if (preg_match('/^x(\d+)$/',      $size, $m)) return (int)$m[1];
    if (preg_match('/^(\d+)$/',       $size, $m)) return (int)$m[1];
    return 500;
}

$width = parse_width($size);

// ── Default cover ──────────────────────────────────────────────
function serve_default()
{
    $path = __DIR__ . '/defaultcover.jpg';
    if (!file_exists($path)) {
        http_response_code(404);
        exit;
    }
    header('Content-Type: image/jpeg');
    header('Content-Length: ' . filesize($path));
    header('Cache-Control: no-store');
    readfile($path);
    exit;
}

if ($zone_id === null) {
    serve_default();
}

// ── AudioServer address ────────────────────────────────────────
global $lbpconfigdir;
$cfg = @json_decode(@file_get_contents($lbpconfigdir . '/plugin.json'), true);

$host = isset($cfg['loxaudioserver']['host']) ? $cfg['loxaudioserver']['host'] : 'localhost';
$port = isset($cfg['loxaudioserver']['port']) ? $cfg['loxaudioserver']['port'] : 7090;
$host = preg_replace('/[^a-zA-Z0-9.\-]/', '', $host);
$port = (int)$port;
if ($port <= 0) $port = 7090;

$url = sprintf('http://%s:%d/api/v1/zones/%d/cover?size=%d', $host, $port, $zone_id, $width);

// ── Request, forwarding the conditional header ─────────────────
$headers = [];
if (isset($_SERVER['HTTP_IF_NONE_MATCH'])) {
    $headers[] = 'If-None-Match: ' . trim($_SERVER['HTTP_IF_NONE_MATCH']);
}

$ctx = stream_context_create(['http' => [
    'timeout'         => 5,
    'follow_location' => true,
    'ignore_errors'   => true,   // read the body of 304/404 instead of failing
    'header'          => implode("\r\n", $headers),
]]);

$body = @file_get_contents($url, false, $ctx);

// $http_response_header is populated by the stream wrapper
$code         = 0;
$etag         = null;
$content_type = 'image/jpeg';
if (isset($http_response_header) && is_array($http_response_header)) {
    foreach ($http_response_header as $i => $h) {
        if ($i === 0 && preg_match('#^HTTP/\S+\s+(\d{3})#', $h, $m)) {
            $code = (int)$m[1];
        } elseif (stripos($h, 'ETag:') === 0) {
            $etag = trim(substr($h, 5));
        } elseif (stripos($h, 'Content-Type:') === 0) {
            $content_type = trim(substr($h, 13));
        }
    }
}

// Nothing playing (404), server unreachable, or an empty body: default cover.
if ($code === 304) {
    if ($etag !== null) header('ETag: ' . $etag);
    header('Cache-Control: public, max-age=10');
    http_response_code(304);
    exit;
}

if ($code !== 200 || $body === false || $body === '') {
    serve_default();
}

// ── Output ─────────────────────────────────────────────────────
if ($etag !== null) header('ETag: ' . $etag);
header('Cache-Control: public, max-age=10');
header('Content-Type: ' . $content_type);
header('Content-Length: ' . strlen($body));
echo $body;
