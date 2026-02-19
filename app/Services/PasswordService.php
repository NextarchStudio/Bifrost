<?php
declare(strict_types=1);

namespace App\Services;

class PasswordService
{
    public function hash(string $password): string
    {
        $hash = password_hash($password, PASSWORD_ARGON2ID);
        if ($hash === false) {
            throw new \RuntimeException('Could not hash password.');
        }

        return $hash;
    }

    public function verify(string $plain, string $hash): bool
    {
        return password_verify($plain, $hash);
    }
}

