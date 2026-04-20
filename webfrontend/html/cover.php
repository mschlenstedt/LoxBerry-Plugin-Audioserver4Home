<?php
ini_set('display_errors', '0');
error_reporting(0);
// cover.php — Serve resized album cover for a given zone

// ── GET parameters ────────────────────────────────────────────
$zone_id = isset($_GET['zone'])   ? intval($_GET['zone'])             : null;
$size    = isset($_GET['size'])   ? trim($_GET['size'])               : '500x500';
$format  = isset($_GET['format']) ? strtolower(trim($_GET['format'])) : 'jpg';

if (!in_array($format, ['jpg', 'png'], true)) {
    $format = 'jpg';
}

// ── Size parsing ───────────────────────────────────────────────
// Returns [width, height] where 0 means "calculate proportionally"
function parse_size(string $size): array
{
    if (preg_match('/^(\d+)x(\d+)$/', $size, $m)) return [(int)$m[1], (int)$m[2]];
    if (preg_match('/^(\d+)x$/',      $size, $m)) return [(int)$m[1], 0];
    if (preg_match('/^x(\d+)$/',      $size, $m)) return [0, (int)$m[1]];
    if (preg_match('/^(\d+)$/',       $size, $m)) return [(int)$m[1], 0];
    return [500, 0];
}

[$req_w, $req_h] = parse_size($size);

// ── Read coverUrl from SHM ─────────────────────────────────────
$cover_url = null;
if ($zone_id !== null) {
    $shm = @file_get_contents('/dev/shm/audioserver4home.json');
    if ($shm) {
        $data = json_decode($shm, true);
        if (is_array($data) && isset($data['zones'])) {
            foreach ($data['zones'] as $zone) {
                if (isset($zone['id']) && (int)$zone['id'] === $zone_id) {
                    $cover_url = isset($zone['coverUrl']) ? $zone['coverUrl'] : null;
                    break;
                }
            }
        }
    }
}

// ── TuneIn URL rewrite ─────────────────────────────────────────
// cdn-profiles.tunein.com: replace logo<x><ext> with logog<ext>
// e.g. logod.jpg -> logog.jpg
function rewrite_tunein_url(string $url): string
{
    $host = parse_url($url, PHP_URL_HOST);
    if ($host === 'cdn-profiles.tunein.com') {
        $url = preg_replace('/(\/logo)\w+(\.(?:jpe?g|png|webp))/i', '${1}g$2', $url);
    }
    return $url;
}

if ($cover_url) {
    $cover_url = rewrite_tunein_url($cover_url);
}

// ── Image loading ──────────────────────────────────────────────
function load_image_from_url(string $url)
{
    $ctx  = stream_context_create(['http' => ['timeout' => 5, 'follow_location' => true]]);
    $data = @file_get_contents($url, false, $ctx);
    if (!$data) return null;
    $img = @imagecreatefromstring($data);
    return $img ?: null;
}

function load_default_cover()
{
    $path = __DIR__ . '/defaultcover.jpg';
    if (!file_exists($path)) return null;
    return @imagecreatefromjpeg($path);
}

$img = null;
if ($cover_url) {
    $img = load_image_from_url($cover_url);
}
if (!$img) {
    $img = load_default_cover();
}
if (!$img) {
    http_response_code(404);
    exit;
}

// ── Compute target dimensions ──────────────────────────────────
$src_w = imagesx($img);
$src_h = imagesy($img);

if ($src_w === 0 || $src_h === 0) {
    imagedestroy($img);
    $img = load_default_cover();
    if (!$img) { http_response_code(404); exit; }
    $src_w = imagesx($img);
    $src_h = imagesy($img);
}

if ($req_w > 0 && $req_h > 0) {
    $dst_w = $req_w;
    $dst_h = $req_h;
} elseif ($req_w > 0) {
    $dst_w = $req_w;
    $dst_h = (int)round($req_w * $src_h / $src_w);
} elseif ($req_h > 0) {
    $dst_h = $req_h;
    $dst_w = (int)round($req_h * $src_w / $src_h);
} else {
    $dst_w = 500;
    $dst_h = (int)round(500 * $src_h / $src_w);
}

// ── Resize ─────────────────────────────────────────────────────
$resized = imagescale($img, $dst_w, $dst_h);
imagedestroy($img);

if (!$resized) {
    http_response_code(500);
    exit;
}

// ── Output ─────────────────────────────────────────────────────
header('Cache-Control: no-store');
if ($format === 'png') {
    header('Content-Type: image/png');
    imagepng($resized);
} else {
    header('Content-Type: image/jpeg');
    imagejpeg($resized, null, 90);
}
if ($resized) imagedestroy($resized);
