<?php
declare(strict_types=1);

namespace App\Services;

use Config\AuthProviders;
use Config\Services;

class DiscordService
{
    public function __construct(private readonly AuthProviders $config = new AuthProviders())
    {
    }

    public function authorizationUrl(): string
    {
        return 'https://discord.com/api/oauth2/authorize?' . http_build_query([
            'client_id'     => $this->config->discordClientId,
            'redirect_uri'  => $this->config->discordRedirectUri,
            'response_type' => 'code',
            'scope'         => 'identify email',
            'prompt'        => 'consent',
        ]);
    }

    public function fetchUserFromCode(string $code): array
    {
        $client = Services::curlrequest(['http_errors' => false]);
        $tokenResponse = $client->post('https://discord.com/api/oauth2/token', [
            'form_params' => [
                'client_id'     => $this->config->discordClientId,
                'client_secret' => $this->config->discordClientSecret,
                'grant_type'    => 'authorization_code',
                'code'          => $code,
                'redirect_uri'  => $this->config->discordRedirectUri,
            ],
        ]);
        $tokenData = json_decode((string) $tokenResponse->getBody(), true);
        if (! isset($tokenData['access_token'])) {
            throw new \RuntimeException('Discord token exchange failed.');
        }

        $userResponse = $client->get('https://discord.com/api/users/@me', [
            'headers' => ['Authorization' => 'Bearer ' . $tokenData['access_token']],
        ]);
        $userData = json_decode((string) $userResponse->getBody(), true);

        return [
            'provider_id' => (string) ($userData['id'] ?? ''),
            'email'       => (string) ($userData['email'] ?? ''),
            'name'        => (string) ($userData['global_name'] ?? $userData['username'] ?? 'Discord User'),
        ];
    }
}

