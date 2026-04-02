<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\PasswordResetTokenRepository;
use App\Repositories\UserRepository;

class PasswordResetService
{
    private const TOKEN_TTL_HOURS = 2;

    public function __construct(
        private readonly UserRepository $users = new UserRepository(),
        private readonly PasswordResetTokenRepository $tokens = new PasswordResetTokenRepository(),
        private readonly PasswordService $passwords = new PasswordService(),
        private readonly AccountEmailService $mailer = new AccountEmailService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function sendInviteForUser(int $userId, int $actorUserId): void
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        $link = $this->issueLink((int) $user->id, 'invite');
        $this->mailer->sendPasswordLink((string) $user->email, (string) $user->name, $link, 'invite');
        $this->audit->log($actorUserId, 'invite', 'user', $userId, ['email' => (string) $user->email]);
    }

    public function sendForgotPasswordLink(string $emailAddress): void
    {
        $emailAddress = mb_substr(strtolower(trim($emailAddress)), 0, 180);
        if ($emailAddress === '') {
            return;
        }

        $user = $this->users->findByEmail($emailAddress);
        if ($user === null || (int) ($user->active ?? 0) !== 1) {
            return;
        }

        $link = $this->issueLink((int) $user->id, 'reset');
        $this->mailer->sendPasswordLink((string) $user->email, (string) $user->name, $link, 'reset');
    }

    public function validateToken(string $token): array
    {
        $tokenHash = hash('sha256', trim($token));
        $record = $this->tokens->findValidByHash($tokenHash);
        if ($record === null) {
            throw new \RuntimeException('Lenken er ugyldig eller har utløpt.');
        }

        $user = $this->users->findById((int) $record['user_id']);
        if ($user === null) {
            throw new \RuntimeException('Bruker finnes ikke.');
        }

        return [
            'token' => $record,
            'user' => $user,
        ];
    }

    public function resetPassword(string $token, string $password, string $passwordConfirmation): void
    {
        if ($password !== $passwordConfirmation) {
            throw new \InvalidArgumentException('Passordene er ikke like.');
        }

        if (mb_strlen($password) < 10) {
            throw new \InvalidArgumentException('Passord må være minst 10 tegn.');
        }

        $payload = $this->validateToken($token);
        $user = $payload['user'];
        $record = $payload['token'];

        $this->users->updateById((int) $user->id, [
            'password_hash' => $this->passwords->hash($password),
            'active' => 1,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->tokens->markUsed((int) $record['id']);
    }

    private function issueLink(int $userId, string $purpose): string
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        $plainToken = bin2hex(random_bytes(32));
        $this->tokens->deleteActiveForUserAndPurpose($userId, $purpose);
        $this->tokens->create([
            'user_id' => $userId,
            'purpose' => $purpose,
            'token_hash' => hash('sha256', $plainToken),
            'expires_at' => date('Y-m-d H:i:s', strtotime('+' . self::TOKEN_TTL_HOURS . ' hours')),
            'used_at' => null,
            'created_at' => date('Y-m-d H:i:s'),
        ]);

        return base_url('auth/reset-password?token=' . urlencode($plainToken));
    }
}
