<?php
require '/var/www/html/vendor/autoload.php';
$app = require '/var/www/html/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

use App\Models\Application;
use Illuminate\Support\Facades\DB;

foreach (Application::query()->orderBy('id')->get(['id', 'name', 'uuid', 'fqdn', 'git_repository', 'git_branch']) as $a) {
    $busy = DB::table('application_deployment_queues')
        ->where('application_id', $a->id)
        ->whereIn('status', ['queued', 'in_progress'])
        ->count();
    echo $a->id . "\t" . $a->uuid . "\t" . $a->name . "\t" . ($a->fqdn ?? '') . "\t" . ($a->git_repository ?? '') . "\tbusy=" . $busy . "\n";
}
