<?php
declare(strict_types=1);

namespace App\Services;

use Config\AuthProviders;
use Config\Services;

class OidcService
{
    public function __construct(private readonly AuthProviders $config = new AuthProviders())
    {
    }

    public function authorizationUrl(): string
    {
        $query = http_build_query([
            'client_id'     => $this->config->keycloakClientId,
            'redirect_uri'  => $this->config->keycloakRedirectUri,
            'response_type' => 'code',
            'scope'         => 'openid email profile',
        ]);

        return rtrim($this->config->keycloakBaseUrl, '/') . '/realms/' . $this->config->keycloakRealm . '/protocol/openid-connect/auth?' . $query;
    }

    public function fetchUserFromCode(string $code): array
    {
        $tokenUrl = rtrim($this->config->keycloakBaseUrl, '/') . '/realms/' . $this->config->keycloakRealm . '/protocol/openid-connect/token';
        $userUrl = rtrim($this->config->keycloakBaseUrl, '/') . '/realms/' . $this->config->keycloakRealm . '/protocol/openid-connect/userinfo';

        $client = Services::curlrequest(['http_errors' => false]);
        $tokenResponse = $client->post($tokenUrl, [
            'form_params' => [
                'grant_type'    => 'authorization_code',
                'client_id'     => $this->config->keycloakClientId,
                'client_secret' => $this->config->keycloakClientSecret,
                'code'          => $code,
                'redirect_uri'  => $this->config->keycloakRedirectUri,
            ],
        ]);

        $tokenData = json_decode((string) $tokenResponse->getBody(), true);
        if (! isset($tokenData['access_token'])) {
            throw new \RuntimeException('OIDC token exchange failed.');
        }

        $userResponse = $client->get($userUrl, [
            'headers' => ['Authorization' => 'Bearer ' . $tokenData['access_token']],
        ]);
        $userData = json_decode((string) $userResponse->getBody(), true);

        return [
            'provider_id' => (string) ($userData['sub'] ?? ''),
            'email'       => (string) ($userData['email'] ?? ''),
            'name'        => (string) ($userData['name'] ?? 'OIDC User'),
        ];
    }
}

