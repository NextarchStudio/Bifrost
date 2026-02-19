<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\CommsRepository;
use App\Repositories\EquipmentRequestRepository;
use App\Repositories\LoanRepository;
use App\Repositories\UserRepository;
use Config\Database;

class ProfileService
{
    public function __construct(
        private readonly UserRepository $users = new UserRepository(),
        private readonly LoanRepository $loans = new LoanRepository(),
        private readonly CommsRepository $comms = new CommsRepository(),
        private readonly EquipmentRequestRepository $requests = new EquipmentRequestRepository(),
        private readonly PasswordService $passwords = new PasswordService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function profileData(int $viewerUserId, ?int $wannabeId = null): array
    {
        $viewer = $this->users->findById($viewerUserId);
        if ($viewer === null) {
            throw new \InvalidArgumentException('Innlogget bruker finnes ikke.');
        }

        $viewerWannabeId = $viewer->wannabe_id !== null ? (int) $viewer->wannabe_id : 0;
        $targetWannabeId = $wannabeId ?? $viewerWannabeId;
        if ($targetWannabeId < 1) {
            throw new \InvalidArgumentException('Ugyldig wannabe-id.');
        }

        $targetUser = $this->users->findByWannabeId($targetWannabeId);
        if ($targetUser === null) {
            throw new \InvalidArgumentException('Profilen finnes ikke.');
        }

        $viewerRoles = $this->users->rolesForUser($viewerUserId);
        $isOwnProfile = $viewerWannabeId > 0 && $viewerWannabeId === $targetWannabeId;
        $canViewOthersLoans = count(array_intersect(['chief', 'co-chief', 'skiftleder', 'sambandsansvarlig', 'developer', 'logistikk'], $viewerRoles)) > 0;
        if (! $isOwnProfile && ! $canViewOthersLoans) {
            throw new \RuntimeException('Du har ikke tilgang til denne profilen.');
        }

        $canViewRequests = $isOwnProfile
            || count(array_intersect(['chief', 'co-chief', 'skiftleder', 'sambandsansvarlig', 'developer'], $viewerRoles)) > 0;

        $db = Database::connect();
        $commsLoans = [];
        if ($targetWannabeId > 0 && $db->tableExists('comms_loans') && $db->tableExists('comms_loan_items')) {
            $commsLoans = $this->comms->activeLoansByWannabeId($targetWannabeId);
        }

        return [
            'user' => $targetUser,
            'roles' => $this->users->rolesForUser((int) $targetUser->id),
            'isOwnProfile' => $isOwnProfile,
            'canViewRequests' => $canViewRequests,
            'loans' => $targetWannabeId > 0 ? $this->loans->loansByWannabeId($targetWannabeId) : [],
            'commsLoans' => $commsLoans,
            'requests' => $canViewRequests ? $this->requests->mineWithSummary((int) $targetUser->id) : [],
        ];
    }

    public function wannabeIdForUser(int $userId): ?int
    {
        $user = $this->users->findById($userId);
        if ($user === null || $user->wannabe_id === null) {
            return null;
        }

        return (int) $user->wannabe_id;
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
