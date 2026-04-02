<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\WannabeCompetencyRepository;
use App\Repositories\SettingsRepository;
use App\Repositories\CrewDirectoryCacheRepository;
use App\Repositories\UserRepository;
use Config\Database;

class AdminService
{
    public function __construct(
        private readonly SettingsRepository $settings = new SettingsRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly WannabeCompetencyRepository $competencies = new WannabeCompetencyRepository(),
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
        }

        return [
            'settings' => $this->settings->get(),
            'users' => $users,
            'roles' => $this->users->allRoles(),
            'roleNamesByUser' => $roleNamesByUser,
            'competencyOptions' => $this->competencyOptions(),
            'crewCacheEntries' => $this->crewCacheCount(),
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
        $defaults = ['developer', 'chief', 'co-chief', 'transport_ansvarlig', 'skiftleder', 'sambandsansvarlig', 'logistikk', 'bruker'];

        foreach ($defaults as $name) {
            $exists = $roleTable->where('name', $name)->get()->getFirstRow();
            if ($exists === null) {
                $roleTable->insert(['name' => $name]);
            }
        }
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
}
