<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\PasswordResetTokenModel;

class PasswordResetTokenRepository
{
    public function __construct(private readonly PasswordResetTokenModel $tokens = new PasswordResetTokenModel())
    {
    }

    public function deleteActiveForUserAndPurpose(int $userId, string $purpose): void
    {
        $this->tokens
            ->where('user_id', $userId)
            ->where('purpose', $purpose)
            ->where('used_at', null)
            ->delete();
    }

    public function create(array $data): int
    {
        $this->tokens->insert($data);

        return (int) $this->tokens->getInsertID();
    }

    public function findValidByHash(string $tokenHash): ?array
    {
        return $this->tokens
            ->where('token_hash', $tokenHash)
            ->where('used_at', null)
            ->where('expires_at >=', date('Y-m-d H:i:s'))
            ->first();
    }

    public function markUsed(int $id): void
    {
        $this->tokens->update($id, ['used_at' => date('Y-m-d H:i:s')]);
    }
}
