<?php
declare(strict_types=1);

namespace Config;

use CodeIgniter\Config\BaseConfig;

class AuthProviders extends BaseConfig
{
    public string $keycloakBaseUrl = '';
    public string $keycloakRealm = '';
    public string $keycloakClientId = '';
    public string $keycloakClientSecret = '';
    public string $keycloakRedirectUri = '';

    public string $discordClientId = '';
    public string $discordClientSecret = '';
    public string $discordRedirectUri = '';

    public function __construct()
    {
        parent::__construct();

        $this->keycloakBaseUrl = (string) env('auth.keycloak.baseUrl', '');
        $this->keycloakRealm = (string) env('auth.keycloak.realm', '');
        $this->keycloakClientId = (string) env('auth.keycloak.clientId', '');
        $this->keycloakClientSecret = (string) env('auth.keycloak.clientSecret', '');
        $this->keycloakRedirectUri = (string) env('auth.keycloak.redirectUri', '');

        $this->discordClientId = (string) env('auth.discord.clientId', '');
        $this->discordClientSecret = (string) env('auth.discord.clientSecret', '');
        $this->discordRedirectUri = (string) env('auth.discord.redirectUri', '');
    }
}
