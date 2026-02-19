<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\SettingsRepository;
use App\Repositories\UserRepository;

class AdminService
{
    public function __construct(
        private readonly SettingsRepository $settings = new SettingsRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly PasswordService $password = new PasswordService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function panelData(): array
    {
        $users = $this->users->all();
        $roleNamesByUser = [];
        foreach ($users as $user) {
            $roleNamesByUser[(int) $user->id] = $this->users->rolesForUser((int) $user->id);
        }

        return [
            'settings' => $this->settings->get(),
            'users'    => $users,
            'roles'    => $this->users->allRoles(),
            'roleNamesByUser' => $roleNamesByUser,
        ];
    }

    public function userDetails(int $userId): array
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        return [
            'user' => $user,
            'roleNames' => $this->users->rolesForUser($userId),
            'roleIds' => $this->users->roleIdsForUser($userId),
        ];
    }

    public function updateSettings(array $input, int $actorUserId): void
    {
        $data = [
            'enable_local_login'    => isset($input['enable_local_login']) ? 1 : 0,
            'enable_discord_login'  => isset($input['enable_discord_login']) ? 1 : 0,
            'enable_keycloak_login' => isset($input['enable_keycloak_login']) ? 1 : 0,
        ];
        $this->settings->update($data);
        $this->audit->log($actorUserId, 'update', 'system_settings', 1, $data);
    }

    public function createUser(array $input, int $actorUserId): int
    {
        $rules = [
            'first_name' => 'required|max_length[80]',
            'last_name'  => 'required|max_length[80]',
            'email'      => 'required|valid_email|max_length[180]',
            'wannabe_id' => 'permit_empty|integer',
            'password'   => 'permit_empty|min_length[10]|max_length[120]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $firstName = mb_substr(strip_tags((string) $input['first_name']), 0, 80);
        $lastName = mb_substr(strip_tags((string) $input['last_name']), 0, 80);
        $fullName = trim($firstName . ' ' . $lastName);

        $id = $this->users->create([
            'name'          => mb_substr($fullName, 0, 120),
            'first_name'    => $firstName,
            'last_name'     => $lastName,
            'email'         => mb_substr(strtolower(trim((string) $input['email'])), 0, 180),
            'wannabe_id'    => ! empty($input['wannabe_id']) ? (int) $input['wannabe_id'] : null,
            'password_hash' => ! empty($input['password']) ? $this->password->hash((string) $input['password']) : null,
            'active'        => 1,
            'created_at'    => date('Y-m-d H:i:s'),
            'updated_at'    => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'create', 'user', $id, ['email' => (string) $input['email']]);

        return $id;
    }

    public function syncUserRoles(int $userId, array $roleIds, int $actorUserId): void
    {
        $filtered = array_map(static fn ($id): int => (int) $id, $roleIds);
        $this->users->syncRoles($userId, $filtered);
        $this->audit->log($actorUserId, 'sync_roles', 'user', $userId, ['roles' => $filtered]);
    }
}
