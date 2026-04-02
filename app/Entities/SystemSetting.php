<?php
declare(strict_types=1);

namespace App\Entities;

use CodeIgniter\Entity\Entity;

class SystemSetting extends Entity
{
    protected $attributes = [
        'id'                    => 1,
        'enable_local_login'    => 1,
        'enable_keycloak_login' => 1,
        'smtp_from_email'       => null,
        'smtp_from_name'        => null,
        'smtp_host'             => null,
        'smtp_port'             => null,
        'smtp_user'             => null,
        'smtp_pass'             => null,
        'smtp_crypto'           => 'tls',
        'google_maps_api_key'   => null,
        'osrm_base_url'         => 'http://localhost:5000',
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
        'crew_cache_year'       => null,
    ];
}

