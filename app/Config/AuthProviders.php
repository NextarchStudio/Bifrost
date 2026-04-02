<?php
declare(strict_types=1);

namespace Config;

use App\Repositories\SettingsRepository;
use CodeIgniter\Config\BaseConfig;

class AuthProviders extends BaseConfig
{
    public string $keycloakBaseUrl = '';
    public string $keycloakRealm = '';
    public string $keycloakClientId = '';
    public string $keycloakClientSecret = '';
    public string $keycloakRedirectUri = '';

    public function __construct()
    {
        parent::__construct();

        $settings = new SettingsRepository();
        $systemSettings = $settings->get();

        $this->keycloakBaseUrl = (string) ($systemSettings->keycloak_base_url ?? env('auth.keycloak.baseUrl', ''));
        $this->keycloakRealm = (string) ($systemSettings->keycloak_realm ?? env('auth.keycloak.realm', ''));
        $this->keycloakClientId = (string) ($systemSettings->keycloak_client_id ?? env('auth.keycloak.clientId', ''));
        $this->keycloakClientSecret = (string) ($systemSettings->keycloak_client_secret ?? env('auth.keycloak.clientSecret', ''));
        $this->keycloakRedirectUri = (string) ($systemSettings->keycloak_redirect_uri ?? env('auth.keycloak.redirectUri', ''));
    }
}
