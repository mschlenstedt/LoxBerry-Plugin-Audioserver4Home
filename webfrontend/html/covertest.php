<?php
header('Content-Type: text/plain');
echo "PHP version: " . phpversion() . "\n";
echo "GD loaded: " . (extension_loaded('gd') ? 'yes' : 'NO') . "\n";
if (extension_loaded('gd')) {
    $info = gd_info();
    echo "GD version: " . $info['GD Version'] . "\n";
    echo "JPEG support: " . ($info['JPEG Support'] ? 'yes' : 'no') . "\n";
    echo "PNG support: " . ($info['PNG Support'] ? 'yes' : 'no') . "\n";
}
echo "allow_url_fopen: " . (ini_get('allow_url_fopen') ? 'yes' : 'NO') . "\n";
echo "SHM readable: " . (is_readable('/dev/shm/audioserver4home.json') ? 'yes' : 'no') . "\n";

// Test syntax of cover.php
$cover = __DIR__ . '/cover.php';
echo "cover.php exists: " . (file_exists($cover) ? 'yes' : 'no') . "\n";

// Try to parse cover.php
$output = shell_exec('php -l ' . escapeshellarg($cover) . ' 2>&1');
echo "php -l cover.php: " . $output . "\n";
