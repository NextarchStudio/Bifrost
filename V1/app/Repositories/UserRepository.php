<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\RoleModel;
use App\Models\UserModel;
use App\Models\UserRoleModel;
use Config\Database;

class UserRepository
{
    public function __construct(
        private readonly UserModel $users = new UserModel(),
        private readonly RoleModel $roles = new RoleModel(),
        private readonly UserRoleModel $userRoles = new UserRoleModel()
    ) {
    }

    public function findById(int $id): ?object
    {
        return $this->users->find($id);
    }

    public function findByEmail(string $email): ?object
    {
        return $this->users->where('email', $email)->first();
    }

    public function findByWannabeId(int $wannabeId): ?object
    {
        return $this->users->where('wannabe_id', $wannabeId)->first();
    }

    public function findByBadgeScanNumber(string $scanNumber): ?object
    {
        $scanNumber = trim($scanNumber);
        if ($scanNumber === '') {
            return null;
        }

        return $this->users->where('badge_scan_number', $scanNumber)->first();
    }

    public function all(): array
    {
        return $this->users->orderBy('name', 'ASC')->findAll();
    }

    public function create(array $data): int
    {
        $this->users->insert($data);

        return (int) $this->users->getInsertID();
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->users->update($id, $data);
    }

    public function clearBadgeScanNumbers(): void
    {
        $this->users->builder()->set('badge_scan_number', null)->update();
    }

    public function deleteById(int $id): bool
    {
        return $this->users->delete($id);
    }

    public function rolesForUser(int $userId): array
    {
        $rows = $this->userRoles
            ->select('roles.name')
            ->join('roles', 'roles.id = user_roles.role_id', 'inner')
            ->where('user_roles.user_id', $userId)
            ->findAll();

        return array_values(array_map(static fn (array $row): string => (string) $row['name'], $rows));
    }

    public function roleDisplayNamesForUser(int $userId): array
    {
        $rows = $this->userRoles
            ->select('roles.name, roles.display_name')
            ->join('roles', 'roles.id = user_roles.role_id', 'inner')
            ->where('user_roles.user_id', $userId)
            ->findAll();

        return array_values(array_map(static function (array $row): string {
            $displayName = trim((string) ($row['display_name'] ?? ''));

            return $displayName !== '' ? $displayName : (string) ($row['name'] ?? '');
        }, $rows));
    }

    public function roleIdsForUser(int $userId): array
    {
        $rows = $this->userRoles
            ->select('role_id')
            ->where('user_id', $userId)
            ->findAll();

        return array_values(array_map(static fn (array $row): int => (int) $row['role_id'], $rows));
    }

    public function allRoles(): array
    {
        return $this->roles->orderBy('name', 'ASC')->findAll();
    }

    public function findRoleById(int $roleId): ?array
    {
        return $this->roles->find($roleId);
    }

    public function findRoleByName(string $name): ?array
    {
        return $this->roles->where('name', $name)->first();
    }

    public function findRoleByWannabeRoleName(string $wannabeRoleName): ?array
    {
        $wannabeRoleName = trim($wannabeRoleName);
        if ($wannabeRoleName === '' || ! Database::connect()->fieldExists('wannabe_role_name', 'roles')) {
            return null;
        }

        return $this->roles->where('wannabe_role_name', $wannabeRoleName)->first();
    }

    public function createRole(array $data): int
    {
        if (! Database::connect()->fieldExists('wannabe_role_name', 'roles')) {
            unset($data['wannabe_role_name']);
        }
        if (! Database::connect()->fieldExists('display_name', 'roles')) {
            unset($data['display_name']);
        }

        $this->roles->insert($data);

        return (int) $this->roles->getInsertID();
    }

    public function updateRoleById(int $roleId, array $data): bool
    {
        if (! Database::connect()->fieldExists('wannabe_role_name', 'roles')) {
            unset($data['wannabe_role_name']);
        }
        if (! Database::connect()->fieldExists('display_name', 'roles')) {
            unset($data['display_name']);
        }

        return $this->roles->update($roleId, $data);
    }

    public function deleteRoleById(int $roleId): bool
    {
        return $this->roles->delete($roleId);
    }

    public function assignRoleByName(int $userId, string $roleName): void
    {
        $role = $this->roles->where('name', $roleName)->first();
        if ($role === null) {
            return;
        }

        $existing = $this->userRoles
            ->where('user_id', $userId)
            ->where('role_id', (int) $role['id'])
            ->first();

        if ($existing !== null) {
            return;
        }

        $this->userRoles->insert([
            'user_id' => $userId,
            'role_id' => (int) $role['id'],
        ]);
    }

    public function assignRolesByWannabeRoleNames(int $userId, array $wannabeRoleNames): array
    {
        $assigned = [];

        foreach ($wannabeRoleNames as $wannabeRoleName) {
            $wannabeRoleName = trim((string) $wannabeRoleName);
            if ($wannabeRoleName === '') {
                continue;
            }

            $role = $this->findRoleByWannabeRoleName($wannabeRoleName);
            if ($role === null) {
                continue;
            }

            $this->assignRoleByName($userId, (string) ($role['name'] ?? ''));
            $assigned[] = (string) ($role['name'] ?? '');
        }

        return array_values(array_unique(array_filter($assigned)));
    }

    public function syncRoles(int $userId, array $roleIds): void
    {
        $this->userRoles->where('user_id', $userId)->delete();
        foreach ($roleIds as $roleId) {
            $this->userRoles->insert(['user_id' => $userId, 'role_id' => (int) $roleId]);
        }
    }
}
