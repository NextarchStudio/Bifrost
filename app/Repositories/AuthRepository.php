<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\AuthAccountModel;
use App\Models\LoginAttemptModel;

class AuthRepository
{
    public function __construct(
        private readonly AuthAccountModel $authAccounts = new AuthAccountModel(),
        private readonly LoginAttemptModel $loginAttempts = new LoginAttemptModel()
    ) {
    }

    public function findAuthAccount(string $provider, string $providerId): ?array
    {
        return $this->authAccounts
            ->where('provider', $provider)
            ->where('provider_id', $providerId)
            ->first();
    }

    public function linkAuthAccount(int $userId, string $provider, string $providerId): void
    {
        $existing = $this->findAuthAccount($provider, $providerId);
        if ($existing !== null) {
            return;
        }
        $this->authAccounts->insert([
            'user_id'     => $userId,
            'provider'    => $provider,
            'provider_id' => $providerId,
        ]);
    }

    public function countFailedAttempts(string $email, string $ip, string $since): int
    {
        return (int) $this->loginAttempts
            ->where('email', $email)
            ->where('ip_address', $ip)
            ->where('successful', 0)
            ->where('created_at >=', $since)
            ->countAllResults();
    }

    public function addLoginAttempt(string $email, string $ip, bool $success): void
    {
        $this->loginAttempts->insert([
            'email'      => $email,
            'ip_address' => $ip,
            'successful' => $success ? 1 : 0,
            'created_at' => date('Y-m-d H:i:s'),
        ]);
    }
}

