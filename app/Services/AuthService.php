<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\AuthRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;
use Config\AuthProviders;

class AuthService
{
    private const OAUTH_PROVIDERS = ['keycloak'];

    public function __construct(
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuthRepository $authRepo = new AuthRepository(),
        private readonly SettingsRepository $settings = new SettingsRepository(),
        private readonly PasswordService $passwords = new PasswordService(),
        private readonly AuthProviders $providers = new AuthProviders()
    ) {
    }

    public function localLoginEnabled(): bool
    {
        return (int) $this->settings->get()->enable_local_login === 1;
    }

    public function localLogin(string $email, string $password, string $ip): array
    {
        if (! $this->localLoginEnabled()) {
            throw new \RuntimeException('Lokal innlogging er deaktivert.');
        }

        $since = date('Y-m-d H:i:s', strtotime('-15 minutes'));
        $attempts = $this->authRepo->countFailedAttempts($email, $ip, $since);
        if ($attempts >= 5) {
            throw new \RuntimeException('For mange innloggingsforsøk. Prøv igjen om 15 minutter.');
        }

        $user = $this->users->findByEmail($email);
        if ($user === null || (int) $user->active !== 1 || empty($user->password_hash) || ! $this->passwords->verify($password, (string) $user->password_hash)) {
            $this->authRepo->addLoginAttempt($email, $ip, false);
            throw new \RuntimeException('Ugyldig brukernavn eller passord.');
        }

        $this->authRepo->addLoginAttempt($email, $ip, true);

        return [
            'user_id' => (int) $user->id,
            'name' => (string) $user->name,
            'first_name' => (string) ($user->first_name ?? explode(' ', (string) $user->name)[0]),
            'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
            'roles' => $this->users->rolesForUser((int) $user->id),
        ];
    }

    public function keycloakEnabled(): bool
    {
        return (int) $this->settings->get()->enable_keycloak_login === 1
            && $this->providers->keycloakBaseUrl !== ''
            && $this->providers->keycloakRealm !== ''
            && $this->providers->keycloakClientId !== ''
            && $this->providers->keycloakClientSecret !== ''
            && $this->providers->keycloakRedirectUri !== '';
    }

    public function ensureProviderEnabled(string $provider): void
    {
        if (! in_array($provider, self::OAUTH_PROVIDERS, true)) {
            throw new \RuntimeException('Ukjent OAuth-provider.');
        }

        if (! $this->keycloakEnabled()) {
            throw new \RuntimeException('Keycloak-innlogging er ikke konfigurert eller er deaktivert.');
        }
    }

    public function upsertProviderUser(string $provider, string $providerId, string $email, string $name, ?int $wannabeId = null): array
    {
        $account = $this->authRepo->findAuthAccount($provider, $providerId);
        if ($account !== null) {
            $user = $this->users->findById((int) $account['user_id']);
            if ($user === null) {
                throw new \RuntimeException('Provider account points to missing user.');
            }
            if ((int) ($user->active ?? 1) !== 1) {
                throw new \RuntimeException('Brukeren er deaktivert.');
            }

            if ($wannabeId !== null && (empty($user->wannabe_id) || (int) $user->wannabe_id !== $wannabeId)) {
                $this->users->updateById((int) $user->id, [
                    'wannabe_id' => $wannabeId,
                    'updated_at' => date('Y-m-d H:i:s'),
                ]);
                $user = $this->users->findById((int) $user->id);
            }

            return [
                'user_id' => (int) $user->id,
                'name' => (string) $user->name,
                'first_name' => (string) ($user->first_name ?? explode(' ', (string) $user->name)[0]),
                'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
                'roles' => $this->users->rolesForUser((int) $user->id),
            ];
        }

        $user = $this->users->findByEmail($email);
        if ($user === null) {
            [$firstName, $lastName] = $this->splitName($name);
            $userId = $this->users->create([
                'name' => mb_substr(trim($firstName . ' ' . $lastName), 0, 120),
                'first_name' => $firstName,
                'last_name' => $lastName,
                'email' => mb_substr(strtolower(trim($email)), 0, 180),
                'wannabe_id' => $wannabeId,
                'password_hash' => null,
                'active' => 1,
                'created_at' => date('Y-m-d H:i:s'),
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $this->users->assignRoleByName($userId, 'bruker');
            $user = $this->users->findById($userId);
        } elseif ($wannabeId !== null && (empty($user->wannabe_id) || (int) $user->wannabe_id !== $wannabeId)) {
            $this->users->updateById((int) $user->id, [
                'wannabe_id' => $wannabeId,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);
            $user = $this->users->findById((int) $user->id);
        }
        if ($user !== null && (int) ($user->active ?? 1) !== 1) {
            throw new \RuntimeException('Brukeren er deaktivert.');
        }

        $this->authRepo->linkAuthAccount((int) $user->id, $provider, $providerId);

        return [
            'user_id' => (int) $user->id,
            'name' => (string) $user->name,
            'first_name' => (string) ($user->first_name ?? explode(' ', (string) $user->name)[0]),
            'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
            'roles' => $this->users->rolesForUser((int) $user->id),
        ];
    }

    /**
     * @return array{0:string,1:string}
     */
    private function splitName(string $name): array
    {
        $clean = trim(preg_replace('/\s+/', ' ', strip_tags($name)) ?? '');
        if ($clean === '') {
            return ['Unknown', 'User'];
        }

        $parts = explode(' ', $clean);
        if (count($parts) === 1) {
            return [mb_substr($parts[0], 0, 80), ''];
        }

        $first = mb_substr((string) array_shift($parts), 0, 80);
        $last = mb_substr(implode(' ', $parts), 0, 80);

        return [$first, $last];
    }
}
