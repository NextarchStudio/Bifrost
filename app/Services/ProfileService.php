<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRequestRepository;
use App\Repositories\LoanRepository;
use App\Repositories\UserRepository;

class ProfileService
{
    public function __construct(
        private readonly UserRepository $users = new UserRepository(),
        private readonly LoanRepository $loans = new LoanRepository(),
        private readonly EquipmentRequestRepository $requests = new EquipmentRequestRepository(),
        private readonly PasswordService $passwords = new PasswordService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function profileData(int $userId): array
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        $wannabeId = $user->wannabe_id !== null ? (int) $user->wannabe_id : 0;

        return [
            'user' => $user,
            'loans' => $wannabeId > 0 ? $this->loans->loansByWannabeId($wannabeId) : [],
            'requests' => $this->requests->mineWithSummary($userId),
        ];
    }

    public function changePassword(int $userId, array $input): void
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        $rules = [
            'new_password' => 'required|min_length[10]|max_length[120]',
            'new_password_confirm' => 'required|matches[new_password]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $currentHash = (string) ($user->password_hash ?? '');
        if ($currentHash !== '') {
            $currentPassword = (string) ($input['current_password'] ?? '');
            if ($currentPassword === '' || ! $this->passwords->verify($currentPassword, $currentHash)) {
                throw new \InvalidArgumentException('Nåværende passord er feil.');
            }
        }

        $newHash = $this->passwords->hash((string) $input['new_password']);
        $this->users->updateById($userId, [
            'password_hash' => $newHash,
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($userId, 'change_password', 'user', $userId);
    }
}

