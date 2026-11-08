<?php
/**
 * Upsert a Coolify application environment variable (encrypted).
 *
 * Usage (inside coolify container):
 *   php /tmp/set-env-var.php <app-uuid> <KEY> <value>
 */
declare(strict_types=1);

if ($argc < 4) {
    fwrite(STDERR, "Usage: php set-env-var.php <app-uuid> <KEY> <value>\n");
    exit(1);
}

$appUuid = $argv[1];
$key = $argv[2];
$value = $argv[3];

require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Application;
use App\Models\EnvironmentVariable;
use Illuminate\Support\Str;

$application = Application::where('uuid', $appUuid)->first();
if (!$application) {
    fwrite(STDERR, "Application not found: {$appUuid}\n");
    exit(2);
}

$ev = EnvironmentVariable::query()
    ->where('resourceable_type', Application::class)
    ->where('resourceable_id', $application->id)
    ->where('key', $key)
    ->where('is_preview', false)
    ->first();

if ($ev) {
    $ev->value = $value;
    $ev->save();
    echo "updated {$key}\n";
    exit(0);
}

$ev = new EnvironmentVariable();
$ev->uuid = (string) Str::uuid();
$ev->key = $key;
$ev->value = $value;
$ev->is_preview = false;
$ev->is_runtime = true;
$ev->is_buildtime = true;
$ev->is_literal = true;
$ev->resourceable_type = Application::class;
$ev->resourceable_id = $application->id;
$ev->save();
echo "created {$key}\n";
