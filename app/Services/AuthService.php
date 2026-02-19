<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\AuthRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;

class AuthService
{
    public function __construct(
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuthRepository $authRepo = new AuthRepository(),
        private readonly SettingsRepository $settings = new SettingsRepository(),
        private readonly PasswordService $passwords = new PasswordService()
    ) {
    }

    public function localLogin(string $email, string $password, string $ip): array
    {
        $setting = $this->settings->get();
        if ((int) $setting->enable_local_login !== 1) {
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
            'name'    => (string) $user->name,
            'first_name' => (string) ($user->first_name ?? explode(' ', (string) $user->name)[0]),
            'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
            'roles'   => $this->users->rolesForUser((int) $user->id),
        ];
    }

    public function keycloakEnabled(): bool
    {
        return (int) $this->settings->get()->enable_keycloak_login === 1;
    }

    public function discordEnabled(): bool
    {
        return (int) $this->settings->get()->enable_discord_login === 1;
    }

    public function upsertProviderUser(string $provider, string $providerId, string $email, string $name): array
    {
        $account = $this->authRepo->findAuthAccount($provider, $providerId);
        if ($account !== null) {
            $user = $this->users->findById((int) $account['user_id']);
            if ($user === null) {
                throw new \RuntimeException('Provider account points to missing user.');
            }

            return [
                'user_id' => (int) $user->id,
                'name'    => (string) $user->name,
                'first_name' => (string) ($user->first_name ?? explode(' ', (string) $user->name)[0]),
                'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
                'roles'   => $this->users->rolesForUser((int) $user->id),
            ];
        }

        $user = $this->users->findByEmail($email);
        if ($user === null) {
            [$firstName, $lastName] = $this->splitName($name);
            $userId = $this->users->create([
                'name'          => mb_substr(trim($firstName . ' ' . $lastName), 0, 120),
                'first_name'    => $firstName,
                'last_name'     => $lastName,
                'email'         => mb_substr(strtolower(trim($email)), 0, 180),
                'password_hash' => null,
                'active'        => 1,
                'created_at'    => date('Y-m-d H:i:s'),
                'updated_at'    => date('Y-m-d H:i:s'),
            ]);
            $user = $this->users->findById($userId);
        }

        $this->authRepo->linkAuthAccount((int) $user->id, $provider, $providerId);

        return [
            'user_id' => (int) $user->id,
            'name'    => (string) $user->name,
            'first_name' => (string) ($user->first_name ?? explode(' ', (string) $user->name)[0]),
            'wannabe_id' => $user->wannabe_id !== null ? (int) $user->wannabe_id : null,
            'roles'   => $this->users->rolesForUser((int) $user->id),
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
