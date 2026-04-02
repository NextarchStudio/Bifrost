<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\RoleModel;
use App\Models\UserModel;
use App\Models\UserRoleModel;

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

    public function syncRoles(int $userId, array $roleIds): void
    {
        $this->userRoles->where('user_id', $userId)->delete();
        foreach ($roleIds as $roleId) {
            $this->userRoles->insert(['user_id' => $userId, 'role_id' => (int) $roleId]);
        }
    }
}
