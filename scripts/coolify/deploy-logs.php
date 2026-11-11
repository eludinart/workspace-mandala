<?php
/** Usage: php deploy-logs.php <deployment-uuid> */
$uuid = $argv[1] ?? '';
if ($uuid === '') {
  fwrite(STDERR, "usage: deploy-logs.php <uuid>\n");
  exit(1);
}
require '/var/www/html/vendor/autoload.php';
$app = require_once '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$row = Illuminate\Support\Facades\DB::table('application_deployment_queues')
  ->where('deployment_uuid', $uuid)
  ->first();
if (!$row) {
  echo "not found\n";
  exit(2);
}
echo ($row->status ?? '?') . "\n";
$logs = (string) ($row->logs ?? '');
echo substr($logs, -5000);
