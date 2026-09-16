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
    protected $allowedFields = ['id', 'app_name', 'enable_local_login', 'enable_keycloak_login', 'smtp_from_email', 'smtp_from_name', 'smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_crypto', 'google_maps_api_key', 'osrm_base_url', 'logo_url', 'favicon_url', 'vegvesen_api_key', 'keycloak_base_url', 'keycloak_realm', 'keycloak_client_id', 'keycloak_client_secret', 'keycloak_redirect_uri', 'crew_api_base_url', 'crew_api_profile_endpoint', 'crew_api_picture_endpoint', 'crew_api_bearer_token', 'crew_cache_year'];
    protected $useTimestamps = false;
}

