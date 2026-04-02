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

    public function authorizationUrl(string $state): string
    {
        $this->assertConfigured();

        $query = http_build_query([
            'client_id' => $this->config->keycloakClientId,
            'redirect_uri' => $this->config->keycloakRedirectUri,
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
        ]);

        return rtrim($this->config->keycloakBaseUrl, '/') . '/realms/' . $this->config->keycloakRealm . '/protocol/openid-connect/auth?' . $query;
    }

    public function fetchUserFromCode(string $code): array
    {
        $this->assertConfigured();

        if ($code === '') {
            throw new \RuntimeException('OIDC callback mangler autorisasjonskode.');
        }

        $tokenUrl = rtrim($this->config->keycloakBaseUrl, '/') . '/realms/' . $this->config->keycloakRealm . '/protocol/openid-connect/token';
        $userUrl = rtrim($this->config->keycloakBaseUrl, '/') . '/realms/' . $this->config->keycloakRealm . '/protocol/openid-connect/userinfo';

        $client = Services::curlrequest(['http_errors' => false]);
        $tokenResponse = $client->post($tokenUrl, [
            'form_params' => [
                'grant_type' => 'authorization_code',
                'client_id' => $this->config->keycloakClientId,
                'client_secret' => $this->config->keycloakClientSecret,
                'code' => $code,
                'redirect_uri' => $this->config->keycloakRedirectUri,
            ],
        ]);

        $tokenData = json_decode((string) $tokenResponse->getBody(), true);
        if ($tokenResponse->getStatusCode() >= 400 || ! is_array($tokenData) || ! isset($tokenData['access_token'])) {
            throw new \RuntimeException('OIDC token exchange failed.');
        }

        $idTokenClaims = $this->decodeJwtPayload((string) ($tokenData['id_token'] ?? ''));
        $accessTokenClaims = $this->decodeJwtPayload((string) ($tokenData['access_token'] ?? ''));

        $userResponse = $client->get($userUrl, [
            'headers' => ['Authorization' => 'Bearer ' . $tokenData['access_token']],
        ]);
        $userData = json_decode((string) $userResponse->getBody(), true);

        if ($userResponse->getStatusCode() >= 400 || ! is_array($userData)) {
            throw new \RuntimeException('OIDC userinfo request failed.');
        }

        $providerId = trim((string) ($userData['sub'] ?? ''));
        $email = trim((string) ($userData['email'] ?? ''));
        if ($providerId === '' || $email === '') {
            throw new \RuntimeException('OIDC-provider returnerte ikke nok brukerdata.');
        }

        $claimSource = array_replace_recursive($accessTokenClaims, $idTokenClaims, $userData);
        $wannabeId = $this->extractWannabeId($claimSource);
        if ($wannabeId === null) {
            log_message('error', 'OIDC wannabe_id missing. Available claim keys: {keys}. Candidate values: {candidates}', [
                'keys' => implode(', ', array_keys($claimSource)),
                'candidates' => json_encode([
                    'sub' => $claimSource['sub'] ?? null,
                    'wannabe_id' => $claimSource['wannabe_id'] ?? null,
                    'wannabeId' => $claimSource['wannabeId'] ?? null,
                    'member_number' => $claimSource['member_number'] ?? null,
                    'memberNumber' => $claimSource['memberNumber'] ?? null,
                    'person_id' => $claimSource['person_id'] ?? null,
                    'personId' => $claimSource['personId'] ?? null,
                    'uid' => $claimSource['uid'] ?? null,
                    'uidNumber' => $claimSource['uidNumber'] ?? null,
                    'employeeNumber' => $claimSource['employeeNumber'] ?? null,
                    'preferred_username' => $claimSource['preferred_username'] ?? null,
                    'nickname' => $claimSource['nickname'] ?? null,
                    'username' => $claimSource['username'] ?? null,
                    'upn' => $claimSource['upn'] ?? null,
                    'email' => $claimSource['email'] ?? null,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }

        return [
            'provider_id' => $providerId,
            'email' => $email,
            'name' => (string) ($userData['name'] ?? 'OIDC User'),
            'wannabe_id' => $wannabeId,
        ];
    }

    private function assertConfigured(): void
    {
        if (
            $this->config->keycloakBaseUrl === ''
            || $this->config->keycloakRealm === ''
            || $this->config->keycloakClientId === ''
            || $this->config->keycloakClientSecret === ''
            || $this->config->keycloakRedirectUri === ''
        ) {
            throw new \RuntimeException('Keycloak/OIDC er ikke konfigurert.');
        }
    }

    private function extractWannabeId(array $userData): ?int
    {
        $candidates = [
            $userData['wannabe_id'] ?? null,
            $userData['wannabeId'] ?? null,
            $userData['member_number'] ?? null,
            $userData['memberNumber'] ?? null,
            $userData['person_id'] ?? null,
            $userData['personId'] ?? null,
            $userData['uid'] ?? null,
            $userData['uidNumber'] ?? null,
            $userData['employeeNumber'] ?? null,
            $userData['preferred_username'] ?? null,
            $userData['nickname'] ?? null,
            $userData['username'] ?? null,
            $userData['upn'] ?? null,
            $userData['email'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if ($candidate === null) {
                continue;
            }

            $value = trim((string) $candidate);
            if ($value === '') {
                continue;
            }

            if (ctype_digit($value)) {
                $wannabeId = (int) $value;
                if ($wannabeId > 0) {
                    return $wannabeId;
                }

                continue;
            }

            if (preg_match('/\b(\d{4,})\b/', $value, $matches) === 1) {
                $wannabeId = (int) $matches[1];
                if ($wannabeId > 0) {
                    return $wannabeId;
                }
            }
        }

        return null;
    }

    private function decodeJwtPayload(string $jwt): array
    {
        $parts = explode('.', $jwt);
        if (count($parts) < 2 || trim($parts[1]) === '') {
            return [];
        }

        $payload = strtr($parts[1], '-_', '+/');
        $padding = strlen($payload) % 4;
        if ($padding > 0) {
            $payload .= str_repeat('=', 4 - $padding);
        }

        $decoded = base64_decode($payload, true);
        if ($decoded === false) {
            return [];
        }

        $data = json_decode($decoded, true);

        return is_array($data) ? $data : [];
    }
}
