<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\DiscordService;
use App\Services\OidcService;

class AuthController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService = new AuthService(),
        private readonly OidcService $oidcService = new OidcService(),
        private readonly DiscordService $discordService = new DiscordService()
    ) {
    }

    public function loginForm()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        return view('auth/login', [
            'keycloakEnabled' => $this->authService->keycloakEnabled(),
            'discordEnabled'  => $this->authService->discordEnabled(),
        ]);
    }

    public function forgotPassword()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        return view('auth/forgot_password');
    }

    public function localLogin()
    {
        try {
            $result = $this->authService->localLogin(
                (string) $this->request->getPost('email'),
                (string) $this->request->getPost('password'),
                (string) $this->request->getIPAddress()
            );
            $this->session->set($result);
            return redirect()->to('/dashboard');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function oidcRedirect()
    {
        if (! $this->authService->keycloakEnabled()) {
            return redirect()->to('/auth/login')->with('error', 'Keycloak login er deaktivert.');
        }

        return redirect()->to($this->oidcService->authorizationUrl());
    }

    public function oidcCallback()
    {
        try {
            $profile = $this->oidcService->fetchUserFromCode((string) $this->request->getGet('code'));
            $result = $this->authService->upsertProviderUser('keycloak', $profile['provider_id'], $profile['email'], $profile['name']);
            $this->session->set($result);
            return redirect()->to('/dashboard');
        } catch (\Throwable $e) {
            return redirect()->to('/auth/login')->with('error', $e->getMessage());
        }
    }

    public function discordRedirect()
    {
        if (! $this->authService->discordEnabled()) {
            return redirect()->to('/auth/login')->with('error', 'Discord login er deaktivert.');
        }

        return redirect()->to($this->discordService->authorizationUrl());
    }

    public function discordCallback()
    {
        try {
            $profile = $this->discordService->fetchUserFromCode((string) $this->request->getGet('code'));
            $result = $this->authService->upsertProviderUser('discord', $profile['provider_id'], $profile['email'], $profile['name']);
            $this->session->set($result);
            return redirect()->to('/dashboard');
        } catch (\Throwable $e) {
            return redirect()->to('/auth/login')->with('error', $e->getMessage());
        }
    }

    public function logout()
    {
        $this->session->destroy();
        return redirect()->to('/auth/login');
    }
}
