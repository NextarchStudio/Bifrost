<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\SystemSettingModel;

class SettingsRepository
{
    public function __construct(private readonly SystemSettingModel $settings = new SystemSettingModel())
    {
    }

    public function get(): object
    {
        $row = $this->settings->find(1);
        if ($row === null) {
            $this->settings->insert([
                'id' => 1,
                'enable_local_login' => 1,
                'enable_keycloak_login' => 1,
                'smtp_from_email' => null,
                'smtp_from_name' => null,
                'smtp_host' => null,
                'smtp_port' => 587,
                'smtp_user' => null,
                'smtp_pass' => null,
                'smtp_crypto' => 'tls',
                'google_maps_api_key' => null,
                'osrm_base_url' => 'http://localhost:5000',
                'logo_url' => 'https://www.tg.no/tg26/tg26_horizontal.svg',
                'vegvesen_api_key' => null,
                'keycloak_base_url' => null,
                'keycloak_realm' => null,
                'keycloak_client_id' => null,
                'keycloak_client_secret' => null,
                'keycloak_redirect_uri' => null,
                'crew_api_base_url' => 'https://tgbt-idam.gathering.org',
                'crew_api_profile_endpoint' => '/v2/profile/',
                'crew_api_picture_endpoint' => '/v2/picture/',
                'crew_api_bearer_token' => null,
                'crew_cache_year' => (int) date('Y'),
            ]);
            return $this->settings->find(1);
        }

        return $row;
    }

    public function update(array $data): bool
    {
        return $this->settings->update(1, $data);
    }
}

