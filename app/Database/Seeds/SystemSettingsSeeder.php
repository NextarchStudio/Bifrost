<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $this->db->table('system_settings')->replace([
            'id'                    => 1,
            'enable_local_login'    => 1,
            'enable_keycloak_login' => 1,
            'logo_url'              => 'https://www.tg.no/tg26/tg26_horizontal.svg',
            'vegvesen_api_key'      => null,
            'keycloak_base_url'     => null,
            'keycloak_realm'        => null,
            'keycloak_client_id'    => null,
            'keycloak_client_secret'=> null,
            'keycloak_redirect_uri' => null,
            'crew_api_base_url'     => 'https://tgbt-idam.gathering.org',
            'crew_api_profile_endpoint' => '/v2/profile/',
            'crew_api_picture_endpoint' => '/v2/picture/',
            'crew_api_bearer_token' => null,
        ]);
    }
}

