<?php
declare(strict_types=1);

namespace App\Models;

use App\Entities\SystemSetting;
use CodeIgniter\Model;

class SystemSettingModel extends Model
{
    protected $table = 'system_settings';
    protected $primaryKey = 'id';
    protected $returnType = SystemSetting::class;
    protected $allowedFields = ['id', 'enable_local_login', 'enable_discord_login', 'enable_keycloak_login'];
    protected $useTimestamps = false;
}

