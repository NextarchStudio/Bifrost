<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\AuthService;
use App\Services\OidcService;
use App\Services\PasswordResetService;

class AuthController extends BaseController
{
    private const OAUTH_STATE_KEY_PREFIX = 'oauth_state_';

    public function __construct(
        private readonly AuthService $authService = new AuthService(),
        private readonly OidcService $oidcService = new OidcService(),
        private readonly PasswordResetService $passwordResets = new PasswordResetService()
    ) {
    }

    public function loginForm()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        return view('auth/login', [
            'localLoginEnabled' => $this->authService->localLoginEnabled(),
            'keycloakEnabled' => $this->authService->keycloakEnabled(),
        ]);
    }

    public function forgotPassword()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        return view('auth/forgot_password');
    }

    public function sendPasswordReset()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        try {
            $this->passwordResets->sendForgotPasswordLink((string) $this->request->getPost('email'));

            return redirect()->to('/auth/forgot-password')->with('message', 'Hvis e-posten finnes hos oss, er en lenke sendt.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function resetPasswordForm()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        try {
            $token = trim((string) $this->request->getGet('token'));
            $payload = $this->passwordResets->validateToken($token);

            return view('auth/reset_password', [
                'token' => $token,
                'email' => (string) $payload['user']->email,
            ]);
        } catch (\Throwable $e) {
            return redirect()->to('/auth/login')->with('error', $e->getMessage());
        }
    }

    public function resetPassword()
    {
        if ($this->session->get('user_id')) {
            return redirect()->to('/dashboard');
        }

        try {
            $this->passwordResets->resetPassword(
                (string) $this->request->getPost('token'),
                (string) $this->request->getPost('password'),
                (string) $this->request->getPost('password_confirmation')
            );

            return redirect()->to('/auth/login')->with('message', 'Passordet er lagret. Du kan nå logge inn.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function localLogin()
    {
        try {
            $result = $this->authService->localLogin(
                (string) $this->request->getPost('email'),
                (string) $this->request->getPost('password'),
                (string) $this->request->getIPAddress()
            );
            $this->completeLogin($result);

            return redirect()->to('/dashboard');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function oidcRedirect()
    {
        try {
            $this->authService->ensureProviderEnabled('keycloak');

            return redirect()->to($this->oidcService->authorizationUrl($this->issueOauthState('keycloak')));
        } catch (\Throwable $e) {
            return redirect()->to('/auth/login')->with('error', $e->getMessage());
        }
    }

    public function oidcCallback()
    {
        try {
            $this->validateOauthCallback('keycloak');
            $profile = $this->oidcService->fetchUserFromCode((string) $this->request->getGet('code'));
            $result = $this->authService->upsertProviderUser(
                'keycloak',
                $profile['provider_id'],
                $profile['email'],
                $profile['name'],
                $profile['wannabe_id'] ?? null,
                (array) ($profile['wannabe_role_names'] ?? [])
            );
            $this->completeLogin($result);

            return redirect()->to('/dashboard');
        } catch (\Throwable $e) {
            return redirect()->to('/auth/login')->with('error', $e->getMessage());
        }
    }

    public function logout()
    {
        $this->session->remove(self::OAUTH_STATE_KEY_PREFIX . 'keycloak');
        $this->session->destroy();

        return redirect()->to('/auth/login');
    }

    private function issueOauthState(string $provider): string
    {
        $state = bin2hex(random_bytes(32));
        $this->session->set(self::OAUTH_STATE_KEY_PREFIX . $provider, $state);

        return $state;
    }

    private function validateOauthCallback(string $provider): void
    {
        $error = trim((string) $this->request->getGet('error'));
        if ($error !== '') {
            $description = trim((string) $this->request->getGet('error_description'));
            throw new \RuntimeException($description !== '' ? $description : 'Innloggingen ble avbrutt hos OAuth-provider.');
        }

        $expectedState = (string) $this->session->get(self::OAUTH_STATE_KEY_PREFIX . $provider);
        $receivedState = trim((string) $this->request->getGet('state'));
        $this->session->remove(self::OAUTH_STATE_KEY_PREFIX . $provider);

        if ($expectedState === '' || $receivedState === '' || ! hash_equals($expectedState, $receivedState)) {
            throw new \RuntimeException('Ugyldig OAuth state. Prøv å logge inn på nytt.');
        }
    }

    private function completeLogin(array $sessionData): void
    {
        $this->session->regenerate(true);
        $this->session->set($sessionData);
    }
}
