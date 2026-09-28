<?php
// WordPress drop-in: copied to wp-content/php-error.php, db-error.php and maintenance.php.
// Must not call any WordPress function — it runs when WordPress itself is broken.
if (!headers_sent()) {
  http_response_code(503);
  header('Retry-After: 600');
  header('Content-Type: text/html; charset=utf-8');
  header('Cache-Control: no-cache, no-store, must-revalidate');
  header('X-LiteSpeed-Cache-Control: no-cache');
}
$page = __DIR__ . '/ecomalwa-down/index.html';
if (is_readable($page)) {
  readfile($page);
} else {
  echo '<!DOCTYPE html><title>We\'ll be back soon</title><h1>Our website is currently down. We\'ll be back very soon.</h1>';
}
exit;
