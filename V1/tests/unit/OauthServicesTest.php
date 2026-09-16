<?php

declare(strict_types=1);

use App\Services\OidcService;
use CodeIgniter\Test\CIUnitTestCase;
use Config\AuthProviders;

final class OauthServicesTest extends CIUnitTestCase
{
    public function testOidcAuthorizationUrlIncludesState(): void
    {
        $service = new OidcService($this->oidcConfig());

        $url = $service->authorizationUrl('state123');

        $this->assertStringContainsString('state=state123', $url);
        $this->assertStringContainsString('scope=openid+email+profile', $url);
    }

    public function testOidcRejectsEmptyCode(): void
    {
        $service = new OidcService($this->oidcConfig());

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('OIDC callback mangler autorisasjonskode.');

        $service->fetchUserFromCode('');
    }

    private function oidcConfig(): AuthProviders
    {
        $config = new AuthProviders();
        $config->keycloakBaseUrl = 'https://sso.example.com';
        $config->keycloakRealm = 'tg';
        $config->keycloakClientId = 'client-id';
        $config->keycloakClientSecret = 'client-secret';
        $config->keycloakRedirectUri = 'https://app.example.com/auth/oidc/callback';

        return $config;
    }
}
