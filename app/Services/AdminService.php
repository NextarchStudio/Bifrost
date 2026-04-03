<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\WannabeCompetencyRepository;
use App\Repositories\CrewClothingRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\CrewDirectoryCacheRepository;
use App\Repositories\UserRepository;
use Config\Database;

class AdminService
{
    private const PROTECTED_ROLE_NAMES = [
        'developer',
        'chief',
        'co-chief',
        'bruker',
    ];

    public function __construct(
        private readonly SettingsRepository $settings = new SettingsRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly WannabeCompetencyRepository $competencies = new WannabeCompetencyRepository(),
        private readonly CrewClothingRepository $crewClothing = new CrewClothingRepository(),
        private readonly CrewDirectoryCacheRepository $crewCache = new CrewDirectoryCacheRepository(),
        private readonly PasswordResetService $passwordResets = new PasswordResetService(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function panelData(): array
    {
        $this->ensureDefaultRoles();

        $users = $this->users->all();
        $roleNamesByUser = [];
        foreach ($users as $user) {
            $roleNamesByUser[(int) $user->id] = $this->users->rolesForUser((int) $user->id);
            $roleDisplayNamesByUser[(int) $user->id] = $this->users->roleDisplayNamesForUser((int) $user->id);
        }

        return [
            'settings' => $this->settings->get(),
            'users' => $users,
            'roles' => $this->users->allRoles(),
            'roleNamesByUser' => $roleNamesByUser,
            'roleDisplayNamesByUser' => $roleDisplayNamesByUser ?? [],
            'competencyOptions' => $this->competencyOptions(),
            'crewCacheEntries' => $this->crewCacheCount(),
            'crewClothingCrews' => $this->crewClothing->crewsWithSummary(),
        ];
    }

    public function statisticsData(): array
    {
        $db = Database::connect();

        return [
            'userStats' => [
                'total' => (int) $db->table('users')->countAllResults(),
                'active' => (int) $db->table('users')->where('active', 1)->countAllResults(),
                'inactive' => (int) $db->table('users')->where('active', 0)->countAllResults(),
                'with_wannabe_id' => (int) $db->table('users')->where('wannabe_id IS NOT NULL', null, false)->countAllResults(),
                'with_badge_scan' => (int) $db->table('users')->where('badge_scan_number IS NOT NULL', null, false)->countAllResults(),
                'cached' => $this->crewCacheCount(),
            ],
            'roleStats' => $this->roleStatistics($db),
            'feedbackStats' => $this->feedbackStatistics($db),
            'equipmentStats' => $this->equipmentStatistics($db),
            'commsStats' => $this->commsStatistics($db),
            'vehicleStats' => $this->vehicleStatistics($db),
            'requestStats' => $this->requestStatistics($db),
            'transportStats' => $this->transportStatistics($db),
            'taskStats' => $this->taskStatistics($db),
            'shopStats' => $this->shopStatistics($db),
            'privateEquipmentStats' => $this->privateEquipmentStatistics($db),
            'locationStats' => $this->locationStatistics($db),
            'warehouseStats' => $this->warehouseStatistics($db),
        ];
    }

    public function clearCrewCache(int $actorUserId): void
    {
        $db = Database::connect();
        $protectedUserId = 2;

        $db->transStart();

        $db->table('crew_directory_cache')->truncate();
        if ($db->tableExists('wannabe_competencies')) {
            $db->table('wannabe_competencies')->truncate();
        }
        if ($db->tableExists('wannabe_vehicle_kdo')) {
            $db->table('wannabe_vehicle_kdo')->truncate();
        }

        $db->table('password_reset_tokens')->where('user_id !=', $protectedUserId)->delete();
        $db->table('feedback_notification_reads')->where('user_id !=', $protectedUserId)->delete();
        $db->table('feedback_entries')->where('requester_user_id !=', $protectedUserId)->delete();
        $db->table('tasks')->where('assigned_user_id !=', $protectedUserId)->delete();
        $db->table('tasks')->where('created_by_user_id !=', $protectedUserId)->delete();
        $db->table('auth_accounts')->where('user_id !=', $protectedUserId)->delete();
        $db->table('user_roles')->where('user_id !=', $protectedUserId)->delete();

        if ($db->tableExists('equipment_requests')) {
            $db->table('equipment_requests')->where('requester_user_id !=', $protectedUserId)->delete();
        }
        if ($db->tableExists('equipment_loans')) {
            $db->table('equipment_loans')->where('issued_by_user_id !=', $protectedUserId)->delete();
        }
        if ($db->tableExists('comms_loans')) {
            $db->table('comms_loans')->where('issued_by_user_id !=', $protectedUserId)->delete();
        }
        if ($db->tableExists('vehicle_loans')) {
            $db->table('vehicle_loans')->where('issued_by_user_id !=', $protectedUserId)->delete();
        }
        if ($db->tableExists('shop_movements')) {
            $db->table('shop_movements')->where('actor_user_id !=', $protectedUserId)->delete();
        }
        if ($db->tableExists('audit_logs')) {
            $db->table('audit_logs')->where('actor_user_id !=', $protectedUserId)->delete();
        }
        if ($db->tableExists('login_attempts')) {
            $db->table('login_attempts')->truncate();
        }
        if ($db->tableExists('transport_jobs')) {
            $db->table('transport_jobs')
                ->where('requester_user_id !=', $protectedUserId)
                ->set(['requester_user_id' => null])
                ->update();
            $db->table('transport_jobs')
                ->where('assigned_user_id !=', $protectedUserId)
                ->set(['assigned_user_id' => null])
                ->update();
        }

        $db->table('users')
            ->where('id !=', $protectedUserId)
            ->delete();

        $db->table('users')
            ->where('id', $protectedUserId)
            ->update([
                'badge_scan_number' => null,
                'updated_at' => date('Y-m-d H:i:s'),
            ]);

        $this->settings->update([
            'crew_cache_year' => (int) date('Y'),
        ]);

        $db->transComplete();

        if (! $db->transStatus()) {
            throw new \RuntimeException('Kunne ikke tømme crew-cache og brukere.');
        }

        $this->audit->log($protectedUserId, 'clear_cache', 'crew_directory_cache', 1, [
            'year' => (int) date('Y'),
            'actor_user_id' => $actorUserId,
            'preserved_user_id' => $protectedUserId,
        ]);
    }

    public function userDetails(int $userId): array
    {
        $this->ensureDefaultRoles();

        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }

        return [
            'user' => $user,
            'roleNames' => $this->users->rolesForUser($userId),
            'roleDisplayNames' => $this->users->roleDisplayNamesForUser($userId),
            'roleIds' => $this->users->roleIdsForUser($userId),
            'competencies' => $user->wannabe_id !== null ? ($this->competencies->findByWannabeId((int) $user->wannabe_id) ?? []) : [],
        ];
    }

    public function updateUserCompetencies(int $userId, array $input, int $actorUserId): void
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }
        if ($user->wannabe_id === null) {
            throw new \InvalidArgumentException('Brukeren må ha Wannabe ID før sertifikater kan lagres.');
        }

        $this->competencies->saveProfile((int) $user->wannabe_id, [
            't1' => isset($input['competencies']['t1']) ? 1 : 0,
            't2' => isset($input['competencies']['t2']) ? 1 : 0,
            't3' => isset($input['competencies']['t3']) ? 1 : 0,
            't4' => isset($input['competencies']['t4']) ? 1 : 0,
            'b' => isset($input['competencies']['b']) ? 1 : 0,
            'be' => isset($input['competencies']['be']) ? 1 : 0,
            'c1' => isset($input['competencies']['c1']) ? 1 : 0,
            'c1e' => isset($input['competencies']['c1e']) ? 1 : 0,
            'c' => isset($input['competencies']['c']) ? 1 : 0,
            'ce' => isset($input['competencies']['ce']) ? 1 : 0,
        ]);

        $this->audit->log($actorUserId, 'update_competencies', 'user', $userId, [
            'wannabe_id' => (int) $user->wannabe_id,
            'competencies' => array_keys(array_filter((array) ($input['competencies'] ?? []))),
        ]);
    }

    public function updateSettings(array $input, int $actorUserId): void
    {
        $current = $this->settings->get();
        $data = [
            'app_name' => $this->nullableTrimmedValue($input['app_name'] ?? null, 180) ?? 'Bifrost',
            'enable_local_login' => isset($input['enable_local_login']) ? 1 : 0,
            'enable_keycloak_login' => isset($input['enable_keycloak_login']) ? 1 : 0,
            'logo_url' => $this->nullableTrimmedValue($input['logo_url'] ?? null, 255),
            'smtp_from_email' => $this->nullableTrimmedValue($input['smtp_from_email'] ?? null, 180),
            'smtp_from_name' => $this->nullableTrimmedValue($input['smtp_from_name'] ?? null, 180),
            'smtp_host' => $this->nullableTrimmedValue($input['smtp_host'] ?? null, 180),
            'smtp_port' => ! empty($input['smtp_port']) ? max(1, (int) $input['smtp_port']) : null,
            'smtp_user' => $this->nullableTrimmedValue($input['smtp_user'] ?? null, 180),
            'smtp_crypto' => $this->normalizeSmtpCrypto((string) ($input['smtp_crypto'] ?? 'tls')),
            'osrm_base_url' => $this->nullableTrimmedValue($input['osrm_base_url'] ?? null, 255),
            'favicon_url' => $this->nullableTrimmedValue($input['favicon_url'] ?? null, 255),
            'vegvesen_api_key' => $this->nullableTrimmedValue($input['vegvesen_api_key'] ?? null, 255),
            'keycloak_base_url' => $this->nullableTrimmedValue($input['keycloak_base_url'] ?? null, 255),
            'keycloak_realm' => $this->nullableTrimmedValue($input['keycloak_realm'] ?? null, 180),
            'keycloak_client_id' => $this->nullableTrimmedValue($input['keycloak_client_id'] ?? null, 180),
            'keycloak_redirect_uri' => $this->nullableTrimmedValue($input['keycloak_redirect_uri'] ?? null, 255),
            'crew_api_base_url' => $this->nullableTrimmedValue($input['crew_api_base_url'] ?? null, 255),
            'crew_api_profile_endpoint' => $this->normalizeCrewEndpoint($input['crew_api_profile_endpoint'] ?? '/v2/profile/'),
            'crew_api_picture_endpoint' => $this->normalizeCrewEndpoint($input['crew_api_picture_endpoint'] ?? '/v2/picture/'),
        ];

        $smtpPass = trim((string) ($input['smtp_pass'] ?? ''));
        $data['smtp_pass'] = $smtpPass !== '' ? mb_substr($smtpPass, 0, 255) : ($current->smtp_pass ?? null);
        $keycloakSecret = trim((string) ($input['keycloak_client_secret'] ?? ''));
        $data['keycloak_client_secret'] = $keycloakSecret !== '' ? mb_substr($keycloakSecret, 0, 255) : ($current->keycloak_client_secret ?? null);
        $crewToken = trim((string) ($input['crew_api_bearer_token'] ?? ''));
        $data['crew_api_bearer_token'] = $crewToken !== '' ? mb_substr($crewToken, 0, 255) : ($current->crew_api_bearer_token ?? null);

        $this->settings->update($data);
        $this->audit->log($actorUserId, 'update', 'system_settings', 1, $data);
    }

    public function createUser(array $input, int $actorUserId): int
    {
        $rules = [
            'first_name' => 'required|max_length[80]',
            'last_name' => 'required|max_length[80]',
            'email' => 'required|valid_email|max_length[180]',
            'wannabe_id' => 'permit_empty|integer',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $firstName = mb_substr(strip_tags((string) $input['first_name']), 0, 80);
        $lastName = mb_substr(strip_tags((string) $input['last_name']), 0, 80);
        $email = mb_substr(strtolower(trim((string) $input['email'])), 0, 180);
        $wannabeId = ! empty($input['wannabe_id']) ? (int) $input['wannabe_id'] : null;

        if ($this->users->findByEmail($email) !== null) {
            throw new \InvalidArgumentException('E-postadressen er allerede i bruk.');
        }
        if ($wannabeId !== null && $this->users->findByWannabeId($wannabeId) !== null) {
            throw new \InvalidArgumentException('Wannabe ID er allerede i bruk.');
        }

        $fullName = trim($firstName . ' ' . $lastName);

        $id = $this->users->create([
            'name' => mb_substr($fullName, 0, 120),
            'first_name' => $firstName,
            'last_name' => $lastName,
            'email' => $email,
            'wannabe_id' => $wannabeId,
            'password_hash' => null,
            'active' => 1,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        try {
            $this->audit->log($actorUserId, 'create', 'user', $id, ['email' => $email]);
            $this->passwordResets->sendInviteForUser($id, $actorUserId);
        } catch (\Throwable $e) {
            $this->users->deleteById($id);
            throw $e;
        }

        return $id;
    }

    public function syncUserRoles(int $userId, array $roleIds, int $actorUserId): void
    {
        $filtered = array_map(static fn ($id): int => (int) $id, $roleIds);
        $this->users->syncRoles($userId, $filtered);
        $this->audit->log($actorUserId, 'sync_roles', 'user', $userId, ['roles' => $filtered]);
    }

    public function createRole(array $input, int $actorUserId): int
    {
        $name = $this->normalizeRoleName((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Rollenavn er påkrevd.');
        }

        if ($this->users->findRoleByName($name) !== null) {
            throw new \InvalidArgumentException('Rollen finnes allerede.');
        }

        $wannabeRoleName = $this->nullableTrimmedValue($input['wannabe_role_name'] ?? null, 150);
        $displayName = $this->nullableTrimmedValue($input['display_name'] ?? null, 100);

        $roleId = $this->users->createRole([
            'name' => $name,
            'wannabe_role_name' => $wannabeRoleName,
            'display_name' => $displayName,
        ]);

        $this->audit->log($actorUserId, 'create', 'role', $roleId, [
            'name' => $name,
            'wannabe_role_name' => $wannabeRoleName,
            'display_name' => $displayName,
        ]);

        return $roleId;
    }

    public function updateRole(int $roleId, array $input, int $actorUserId): void
    {
        $role = $this->users->findRoleById($roleId);
        if ($role === null) {
            throw new \InvalidArgumentException('Rollen finnes ikke.');
        }

        $name = $this->normalizeRoleName((string) ($input['name'] ?? ''));
        if ($name === '') {
            throw new \InvalidArgumentException('Rollenavn er påkrevd.');
        }

        $existing = $this->users->findRoleByName($name);
        if ($existing !== null && (int) ($existing['id'] ?? 0) !== $roleId) {
            throw new \InvalidArgumentException('Et annet rollenavn bruker dette navnet allerede.');
        }

        $data = [
            'name' => $name,
            'wannabe_role_name' => $this->nullableTrimmedValue($input['wannabe_role_name'] ?? null, 150),
            'display_name' => $this->nullableTrimmedValue($input['display_name'] ?? null, 100),
        ];

        $this->users->updateRoleById($roleId, $data);
        $this->audit->log($actorUserId, 'update', 'role', $roleId, $data);
    }

    public function deleteRole(int $roleId, int $actorUserId): void
    {
        $role = $this->users->findRoleById($roleId);
        if ($role === null) {
            throw new \InvalidArgumentException('Rollen finnes ikke.');
        }

        $roleName = (string) ($role['name'] ?? '');
        if (in_array($roleName, self::PROTECTED_ROLE_NAMES, true)) {
            throw new \InvalidArgumentException('Denne rollen er beskyttet og kan ikke slettes.');
        }

        try {
            $this->users->deleteRoleById($roleId);
        } catch (\Throwable) {
            throw new \InvalidArgumentException('Rollen kan ikke slettes fordi den er i bruk av en eller flere brukere.');
        }

        $this->audit->log($actorUserId, 'delete', 'role', $roleId, ['name' => $roleName]);
    }

    public function updateUserActive(int $userId, bool $active, int $actorUserId): void
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }
        if ($userId === $actorUserId && ! $active) {
            throw new \InvalidArgumentException('Du kan ikke deaktivere din egen bruker.');
        }

        $this->users->updateById($userId, [
            'active' => $active ? 1 : 0,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'status', 'user', $userId, ['active' => $active ? 1 : 0]);
    }

    public function deleteUser(int $userId, int $actorUserId): void
    {
        $user = $this->users->findById($userId);
        if ($user === null) {
            throw new \InvalidArgumentException('Bruker finnes ikke.');
        }
        if ($userId === $actorUserId) {
            throw new \InvalidArgumentException('Du kan ikke slette din egen bruker.');
        }

        $db = Database::connect();
        $blockingReferences = [
            'utlån' => (int) $db->table('equipment_loans')->where('issued_by_user_id', $userId)->countAllResults(),
            'forespørsler' => (int) $db->table('equipment_requests')->where('requester_user_id', $userId)->countAllResults(),
            'auditlogg' => (int) $db->table('audit_logs')->where('actor_user_id', $userId)->countAllResults(),
        ];

        if ($db->tableExists('shop_movements')) {
            $blockingReferences['shop-bevegelser'] = (int) $db->table('shop_movements')->where('actor_user_id', $userId)->countAllResults();
        }

        if ($db->tableExists('comms_loans')) {
            $blockingReferences['sambandsutlån'] = (int) $db->table('comms_loans')->where('issued_by_user_id', $userId)->countAllResults();
        }

        $activeBlocks = array_filter($blockingReferences, static fn (int $count): bool => $count > 0);
        if ($activeBlocks !== []) {
            throw new \InvalidArgumentException('Bruker kan ikke slettes fordi den er knyttet til: ' . implode(', ', array_keys($activeBlocks)) . '.');
        }

        $this->users->deleteById($userId);
        $this->audit->log($actorUserId, 'delete', 'user', $userId, ['email' => (string) $user->email]);
    }

    private function ensureDefaultRoles(): void
    {
        $db = Database::connect();
        $roleTable = $db->table('roles');
        $defaults = ['developer', 'chief', 'co-chief', 'transport_ansvarlig', 'skiftleder', 'sambandsansvarlig', 'logistikk', 'shop', 'innkjop', 'bruker'];
        $hasWannabeRoleName = $db->fieldExists('wannabe_role_name', 'roles');

        foreach ($defaults as $name) {
            $exists = $roleTable->where('name', $name)->get()->getFirstRow();
            if ($exists === null) {
                $payload = ['name' => $name];
                if ($hasWannabeRoleName) {
                    $payload['wannabe_role_name'] = null;
                }
                if ($db->fieldExists('display_name', 'roles')) {
                    $payload['display_name'] = $this->defaultRoleDisplayName($name);
                }
                $roleTable->insert($payload);
            }
        }
    }

    private function defaultRoleDisplayName(string $roleName): string
    {
        return match ($roleName) {
            'bruker' => 'Bruker',
            'chief' => 'Chief',
            'co-chief' => 'Co-Chief',
            'developer' => 'Utvikler',
            'logistikk' => 'Logistikk',
            'shop' => 'Shop',
            'innkjop' => 'Innkjøp',
            'sambandsansvarlig' => 'Sambandsansvarlig',
            'skiftleder' => 'Skiftleder',
            'transport_ansvarlig' => 'Transport Ansvarlig',
            'ingen_tilbakemeldinger' => 'Felles Bruker',
            default => $roleName,
        };
    }

    private function normalizeRoleName(string $value): string
    {
        $clean = mb_strtolower(trim(strip_tags($value)));
        $clean = preg_replace('/\s+/', '_', $clean) ?? $clean;
        $clean = preg_replace('/[^a-z0-9_-]/', '', $clean) ?? $clean;

        return mb_substr($clean, 0, 50);
    }

    private function nullableTrimmedValue(mixed $value, int $maxLength): ?string
    {
        $clean = trim(strip_tags((string) $value));

        return $clean !== '' ? mb_substr($clean, 0, $maxLength) : null;
    }

    private function normalizeSmtpCrypto(string $value): ?string
    {
        $value = strtolower(trim($value));

        return in_array($value, ['', 'tls', 'ssl'], true) ? ($value !== '' ? $value : null) : 'tls';
    }

    private function normalizeCrewEndpoint(mixed $value): string
    {
        $clean = trim((string) $value);
        if ($clean === '') {
            return '/';
        }

        return '/' . trim($clean, '/') . '/';
    }

    private function competencyOptions(): array
    {
        return [
            'Kompetansebevis' => [
                't1' => 'T1',
                't2' => 'T2',
                't3' => 'T3',
                't4' => 'T4',
            ],
            'Førerkort' => [
                'b' => 'B',
                'be' => 'BE',
                'c1' => 'C1',
                'c1e' => 'C1E',
                'c' => 'C',
                'ce' => 'CE',
            ],
        ];
    }

    private function crewCacheCount(): int
    {
        return (int) Database::connect()->table('crew_directory_cache')->countAllResults();
    }

    private function roleStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $rows = $db->table('user_roles ur')
            ->select('roles.name, COUNT(*) AS total')
            ->join('roles', 'roles.id = ur.role_id', 'inner')
            ->groupBy('roles.name')
            ->orderBy('total', 'DESC')
            ->orderBy('roles.name', 'ASC')
            ->get()
            ->getResultArray();

        return array_map(static function (array $row): array {
            return [
                'name' => (string) ($row['name'] ?? ''),
                'display_name' => trim((string) ($row['display_name'] ?? '')) !== '' ? (string) $row['display_name'] : (string) ($row['name'] ?? ''),
                'total' => (int) ($row['total'] ?? 0),
            ];
        }, $rows);
    }

    private function feedbackStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $statusRows = $db->table('feedback_entries')
            ->select('status, COUNT(*) AS total')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $typeRows = $db->table('feedback_entries')
            ->select('type, COUNT(*) AS total')
            ->groupBy('type')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $statusMap[(string) ($row['status'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        $typeMap = [];
        foreach ($typeRows as $row) {
            $typeMap[(string) ($row['type'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        return [
            'total' => (int) $db->table('feedback_entries')->countAllResults(),
            'pending' => (int) ($statusMap['pending'] ?? 0),
            'approved' => (int) ($statusMap['approved'] ?? 0),
            'on_hold' => (int) ($statusMap['on_hold'] ?? 0),
            'in_progress' => (int) ($statusMap['in_progress'] ?? 0),
            'implemented' => (int) ($statusMap['added'] ?? 0),
            'fixed' => (int) ($statusMap['fixed'] ?? 0),
            'completed_total' => (int) (($statusMap['added'] ?? 0) + ($statusMap['fixed'] ?? 0)),
            'rejected' => (int) ($statusMap['rejected'] ?? 0),
            'needs_database_fix' => (int) $db->table('feedback_entries')->where('needs_database_fix', 1)->countAllResults(),
            'feature_total' => (int) ($typeMap['feature'] ?? 0),
            'bug_total' => (int) ($typeMap['bug'] ?? 0),
        ];
    }

    private function equipmentStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $statusRows = $db->table('equipment')
            ->select('status, COUNT(*) AS total_rows, COALESCE(SUM(quantity), 0) AS total_quantity')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $categoryRows = $db->table('equipment')
            ->select('category, COUNT(*) AS total_rows, COALESCE(SUM(quantity), 0) AS total_quantity')
            ->groupBy('category')
            ->orderBy('total_quantity', 'DESC')
            ->orderBy('category', 'ASC')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $status = (string) ($row['status'] ?? '');
            $statusMap[$status] = [
                'rows' => (int) ($row['total_rows'] ?? 0),
                'quantity' => (int) ($row['total_quantity'] ?? 0),
            ];
        }

        return [
            'total_items' => (int) $db->table('equipment')->countAllResults(),
            'total_quantity' => (int) ($db->table('equipment')->select('COALESCE(SUM(quantity), 0) AS total')->get()->getRowArray()['total'] ?? 0),
            'available_quantity' => (int) ($statusMap['available']['quantity'] ?? 0),
            'loaned_quantity' => (int) ($statusMap['loaned']['quantity'] ?? 0),
            'maintenance_quantity' => (int) ($statusMap['maintenance']['quantity'] ?? 0),
            'active_loans' => (int) $db->table('equipment_loans')->where('status', 'active')->countAllResults(),
            'loaned_out_quantity' => (int) ($db->table('equipment_loans')->select('COALESCE(SUM(quantity), 0) AS total')->where('status', 'active')->get()->getRowArray()['total'] ?? 0),
            'returned_loans' => (int) $db->table('equipment_loans')->where('status', 'returned')->countAllResults(),
            'returned_quantity' => (int) ($db->table('equipment_loans')->select('COALESCE(SUM(quantity), 0) AS total')->where('status', 'returned')->get()->getRowArray()['total'] ?? 0),
            'loan_events_total' => (int) $db->table('equipment_loans')->countAllResults(),
            'categories' => array_map(static function (array $row): array {
                return [
                    'name' => (string) ($row['category'] ?? 'Ukjent'),
                    'rows' => (int) ($row['total_rows'] ?? 0),
                    'quantity' => (int) ($row['total_quantity'] ?? 0),
                ];
            }, $categoryRows),
        ];
    }

    private function commsStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $typeRows = $db->table('comms_items')
            ->select('type, COUNT(*) AS total_rows, COALESCE(SUM(quantity), 0) AS total_quantity')
            ->groupBy('type')
            ->orderBy('total_quantity', 'DESC')
            ->orderBy('type', 'ASC')
            ->get()
            ->getResultArray();

        $statusRows = $db->table('comms_items')
            ->select('status, COALESCE(SUM(quantity), 0) AS total_quantity')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $statusMap[(string) ($row['status'] ?? '')] = (int) ($row['total_quantity'] ?? 0);
        }

        return [
            'total_items' => (int) $db->table('comms_items')->countAllResults(),
            'total_quantity' => (int) ($db->table('comms_items')->select('COALESCE(SUM(quantity), 0) AS total')->get()->getRowArray()['total'] ?? 0),
            'available_quantity' => (int) ($statusMap['available'] ?? 0),
            'loaned_quantity' => (int) ($statusMap['loaned'] ?? 0),
            'total_sets' => (int) $db->table('comms_sets')->countAllResults(),
            'active_loans' => (int) $db->table('comms_loans')->where('status', 'active')->countAllResults(),
            'returned_loans' => (int) $db->table('comms_loans')->where('status', 'returned')->countAllResults(),
            'loaned_out_quantity' => (int) ($db->table('comms_loan_items cli')
                ->select('COALESCE(SUM(cli.quantity), 0) AS total')
                ->join('comms_loans cl', 'cl.id = cli.loan_id', 'inner')
                ->where('cl.status', 'active')
                ->get()
                ->getRowArray()['total'] ?? 0),
            'returned_quantity' => (int) ($db->table('comms_loan_items cli')
                ->select('COALESCE(SUM(cli.quantity), 0) AS total')
                ->join('comms_loans cl', 'cl.id = cli.loan_id', 'inner')
                ->where('cl.status', 'returned')
                ->get()
                ->getRowArray()['total'] ?? 0),
            'loan_events_total' => (int) $db->table('comms_loans')->countAllResults(),
            'types' => array_map(static function (array $row): array {
                return [
                    'name' => (string) ($row['type'] ?? 'Ukjent'),
                    'rows' => (int) ($row['total_rows'] ?? 0),
                    'quantity' => (int) ($row['total_quantity'] ?? 0),
                ];
            }, $typeRows),
        ];
    }

    private function vehicleStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $statusRows = $db->table('vehicles')
            ->select('status, COUNT(*) AS total')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $statusMap[(string) ($row['status'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        return [
            'total' => (int) $db->table('vehicles')->countAllResults(),
            'available' => (int) ($statusMap['available'] ?? 0),
            'loaned' => (int) ($statusMap['loaned'] ?? 0),
            'maintenance' => (int) ($statusMap['maintenance'] ?? 0),
            'active_loans' => (int) $db->table('vehicle_loans')->where('status', 'active')->countAllResults(),
            'returned_loans' => (int) $db->table('vehicle_loans')->where('status', 'returned')->countAllResults(),
            'loan_events_total' => (int) $db->table('vehicle_loans')->countAllResults(),
            'assigned_transport_jobs' => (int) $db->table('transport_jobs')->where('assigned_vehicle_id IS NOT NULL', null, false)->countAllResults(),
        ];
    }

    private function requestStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $statusRows = $db->table('equipment_requests')
            ->select('status, COUNT(*) AS total')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $statusMap[(string) ($row['status'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        return [
            'total' => (int) $db->table('equipment_requests')->countAllResults(),
            'pending' => (int) ($statusMap['pending'] ?? 0),
            'partial' => (int) ($statusMap['partial'] ?? 0),
            'fulfilled' => (int) ($statusMap['fulfilled'] ?? 0),
            'returned' => (int) ($statusMap['returned'] ?? 0),
            'rejected' => (int) ($statusMap['rejected'] ?? 0),
            'requested_quantity' => (int) ($db->table('equipment_request_items')->select('COALESCE(SUM(quantity), 0) AS total')->get()->getRowArray()['total'] ?? 0),
            'request_lines' => (int) $db->table('equipment_request_items')->countAllResults(),
        ];
    }

    private function transportStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $statusRows = $db->table('transport_jobs')
            ->select('status, COUNT(*) AS total')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $statusMap[(string) ($row['status'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        return [
            'total' => (int) $db->table('transport_jobs')->countAllResults(),
            'open' => (int) ($statusMap['open'] ?? 0),
            'assigned' => (int) ($statusMap['assigned'] ?? 0),
            'in_progress' => (int) ($statusMap['in_progress'] ?? 0),
            'completed' => (int) ($statusMap['completed'] ?? 0),
            'people_transport' => (int) $db->table('transport_jobs')->where('transport_type', 'people')->countAllResults(),
            'equipment_transport' => (int) $db->table('transport_jobs')->where('transport_type', 'equipment')->countAllResults(),
        ];
    }

    private function taskStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $statusRows = $db->table('tasks')
            ->select('status, COUNT(*) AS total')
            ->groupBy('status')
            ->get()
            ->getResultArray();

        $statusMap = [];
        foreach ($statusRows as $row) {
            $statusMap[(string) ($row['status'] ?? '')] = (int) ($row['total'] ?? 0);
        }

        return [
            'total' => (int) $db->table('tasks')->countAllResults(),
            'not_started' => (int) ($statusMap['not_started'] ?? 0),
            'in_progress' => (int) ($statusMap['in_progress'] ?? 0),
            'blocked' => (int) ($statusMap['blocked'] ?? 0),
            'completed' => (int) ($statusMap['completed'] ?? 0),
            'linked_to_transport' => (int) $db->table('tasks')->where('transport_job_id IS NOT NULL', null, false)->countAllResults(),
        ];
    }

    private function shopStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $movementRows = $db->table('shop_movements')
            ->select('movement_type, COUNT(*) AS total_rows, COALESCE(SUM(quantity), 0) AS total_quantity')
            ->groupBy('movement_type')
            ->get()
            ->getResultArray();

        $movementMap = [];
        foreach ($movementRows as $row) {
            $movementMap[(string) ($row['movement_type'] ?? '')] = [
                'rows' => (int) ($row['total_rows'] ?? 0),
                'quantity' => (int) ($row['total_quantity'] ?? 0),
            ];
        }

        return [
            'categories' => (int) $db->table('shop_categories')->countAllResults(),
            'items' => (int) $db->table('shop_items')->countAllResults(),
            'total_quantity' => (int) ($db->table('shop_items')->select('COALESCE(SUM(quantity), 0) AS total')->get()->getRowArray()['total'] ?? 0),
            'checkout_count' => (int) ($movementMap['checkout']['rows'] ?? 0),
            'checkout_quantity' => (int) ($movementMap['checkout']['quantity'] ?? 0),
            'checkin_count' => (int) ($movementMap['checkin']['rows'] ?? 0),
            'checkin_quantity' => (int) ($movementMap['checkin']['quantity'] ?? 0),
            'movements_total' => (int) $db->table('shop_movements')->countAllResults(),
        ];
    }

    private function privateEquipmentStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        return [
            'prefix_rules' => (int) $db->table('private_equipment_prefixes')->countAllResults(),
        ];
    }

    private function locationStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        $typeRows = $db->table('locations')
            ->select('type, COUNT(*) AS total')
            ->groupBy('type')
            ->orderBy('total', 'DESC')
            ->get()
            ->getResultArray();

        return [
            'total' => (int) $db->table('locations')->countAllResults(),
            'with_address' => (int) $db->table('locations')->where('address IS NOT NULL', null, false)->where('address !=', '')->countAllResults(),
            'types' => array_map(static function (array $row): array {
                return [
                    'name' => (string) ($row['type'] ?? 'Ukjent'),
                    'total' => (int) ($row['total'] ?? 0),
                ];
            }, $typeRows),
        ];
    }

    private function warehouseStatistics(\CodeIgniter\Database\BaseConnection $db): array
    {
        return [
            'pallets' => (int) $db->table('pallets')->countAllResults(),
            'slots' => (int) $db->table('pallet_slots')->countAllResults(),
            'occupied_slots' => (int) $db->table('equipment')->where('pallet_slot_id IS NOT NULL', null, false)->distinct()->select('pallet_slot_id')->countAllResults(),
        ];
    }
}
