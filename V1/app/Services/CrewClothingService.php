<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\CrewClothingRepository;
use App\Repositories\UserRepository;

class CrewClothingService
{
    private const ITEM_TYPES = [
        'tshirt' => 'T-skjorte',
        'hoodie' => 'Genser',
    ];

    private const SIZE_OPTIONS = [
        'XXS',
        'XS',
        'S',
        'M',
        'L',
        'XL',
        'XXL',
        'XXXL',
        'XXXXL',
        'XXXXXL',
        'XXXXXXL',
    ];

    public function __construct(
        private readonly CrewClothingRepository $crewClothing = new CrewClothingRepository(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function data(?string $query = null): array
    {
        $selectedMember = null;
        $lookupError = null;
        $query = trim((string) $query);

        if ($query !== '') {
            try {
                $selectedMember = $this->lookupOrCreateMember($query);
            } catch (\Throwable $e) {
                $lookupError = $e->getMessage();
            }
        }

        return [
            'crews' => $this->crewClothing->crewsWithSummary(),
            'members' => $this->crewClothing->members(),
            'inventory' => $this->crewClothing->inventory(),
            'selectedMember' => $selectedMember,
            'lookupQuery' => $query,
            'lookupError' => $lookupError,
            'sizeOptions' => self::SIZE_OPTIONS,
            'itemTypeOptions' => self::ITEM_TYPES,
        ];
    }

    public function memberById(int $memberId): ?array
    {
        if ($memberId < 1) {
            return null;
        }

        return $this->crewClothing->findMemberById($memberId);
    }

    public function lookupMember(string $query): array
    {
        return $this->lookupOrCreateMember($query);
    }

    public function createCrew(array $input, int $actorUserId): int
    {
        $name = mb_substr(trim(strip_tags((string) ($input['name'] ?? ''))), 0, 120);
        if ($name === '') {
            throw new \InvalidArgumentException('Crew-navn er påkrevd.');
        }

        $existing = $this->crewClothing->findCrewByName($name);
        if ($existing !== null) {
            throw new \InvalidArgumentException('Crew finnes allerede.');
        }

        $id = $this->crewClothing->createCrew([
            'name' => $name,
            'tshirt_max' => $this->normalizeMaxCount($input['tshirt_max'] ?? 1),
            'hoodie_max' => $this->normalizeMaxCount($input['hoodie_max'] ?? 1),
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'create', 'crew_clothing_crew', $id, ['name' => $name]);

        return $id;
    }

    public function updateCrew(int $crewId, array $input, int $actorUserId): void
    {
        $crew = $this->crewClothing->findCrewById($crewId);
        if ($crew === null) {
            throw new \InvalidArgumentException('Crew finnes ikke.');
        }

        $name = mb_substr(trim(strip_tags((string) ($input['name'] ?? ''))), 0, 120);
        if ($name === '') {
            throw new \InvalidArgumentException('Crew-navn er påkrevd.');
        }

        $existing = $this->crewClothing->findCrewByName($name);
        if ($existing !== null && (int) ($existing['id'] ?? 0) !== $crewId) {
            throw new \InvalidArgumentException('Et annet crew bruker allerede dette navnet.');
        }

        $data = [
            'name' => $name,
            'tshirt_max' => $this->normalizeMaxCount($input['tshirt_max'] ?? 0),
            'hoodie_max' => $this->normalizeMaxCount($input['hoodie_max'] ?? 0),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $this->crewClothing->updateCrewById($crewId, $data);
        $this->audit->log($actorUserId, 'update', 'crew_clothing_crew', $crewId, $data);
    }

    public function updateMember(int $memberId, array $input, int $actorUserId): void
    {
        $member = $this->crewClothing->findMemberById($memberId);
        if ($member === null) {
            throw new \InvalidArgumentException('Crewmedlem finnes ikke.');
        }

        $crewId = ! empty($input['crew_id']) ? (int) $input['crew_id'] : null;
        if ($crewId !== null && $crewId > 0 && $this->crewClothing->findCrewById($crewId) === null) {
            throw new \InvalidArgumentException('Valgt crew finnes ikke.');
        }

        $data = [
            'crew_id' => $crewId !== null && $crewId > 0 ? $crewId : null,
            'tshirt_size' => $this->normalizeSize($input['tshirt_size'] ?? null),
            'hoodie_size' => $this->normalizeSize($input['hoodie_size'] ?? null),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $this->crewClothing->updateMemberById($memberId, $data);
        $this->audit->log($actorUserId, 'update', 'crew_clothing_member', $memberId, $data);
    }

    public function setDelivered(int $memberId, string $itemType, bool $delivered, int $actorUserId): void
    {
        $member = $this->crewClothing->findMemberById($memberId);
        if ($member === null) {
            throw new \InvalidArgumentException('Crewmedlem finnes ikke.');
        }

        if (! in_array($itemType, ['tshirt', 'hoodie'], true)) {
            throw new \InvalidArgumentException('Ugyldig plaggtype.');
        }

        $sizeField = $itemType . '_size';
        $deliveredField = $itemType . '_delivered';
        $deliveredAtField = $itemType . '_delivered_at';
        $deliveredByField = $itemType . '_delivered_by_user_id';

        if ($delivered && trim((string) ($member[$sizeField] ?? '')) === '') {
            throw new \InvalidArgumentException('Velg størrelse før utlevering registreres.');
        }

        $data = [
            $deliveredField => $delivered ? 1 : 0,
            $deliveredAtField => $delivered ? date('Y-m-d H:i:s') : null,
            $deliveredByField => $delivered ? $actorUserId : null,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $this->crewClothing->updateMemberById($memberId, $data);
        $this->audit->log($actorUserId, $delivered ? 'deliver' : 'undo_deliver', 'crew_clothing_member', $memberId, [
            'item_type' => $itemType,
            'delivered' => $delivered ? 1 : 0,
        ]);
    }

    public function saveInventory(array $input, int $actorUserId): void
    {
        $itemType = trim((string) ($input['item_type'] ?? ''));
        if (! array_key_exists($itemType, self::ITEM_TYPES)) {
            throw new \InvalidArgumentException('Ugyldig plaggtype.');
        }

        $size = $this->normalizeSize($input['size'] ?? null);
        if ($size === null) {
            throw new \InvalidArgumentException('Velg størrelse.');
        }

        $quantity = $this->normalizeMaxCount($input['quantity'] ?? 0);
        $now = date('Y-m-d H:i:s');
        $existing = $this->crewClothing->findInventoryByTypeAndSize($itemType, $size);

        if ($existing === null) {
            $inventoryId = $this->crewClothing->createInventory([
                'item_type' => $itemType,
                'size' => $size,
                'quantity' => $quantity,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $this->audit->log($actorUserId, 'create', 'crew_clothing_inventory', $inventoryId, [
                'item_type' => $itemType,
                'size' => $size,
                'quantity' => $quantity,
            ]);

            return;
        }

        $this->crewClothing->updateInventoryById((int) $existing['id'], [
            'quantity' => $quantity,
            'updated_at' => $now,
        ]);
        $this->audit->log($actorUserId, 'update', 'crew_clothing_inventory', (int) $existing['id'], [
            'item_type' => $itemType,
            'size' => $size,
            'quantity' => $quantity,
        ]);
    }

    public function updateInventory(int $inventoryId, array $input, int $actorUserId): void
    {
        $existing = $this->crewClothing->findInventoryById($inventoryId);
        if ($existing === null) {
            throw new \InvalidArgumentException('Varelinjen finnes ikke.');
        }

        $itemType = trim((string) ($input['item_type'] ?? ''));
        if (! array_key_exists($itemType, self::ITEM_TYPES)) {
            throw new \InvalidArgumentException('Ugyldig plaggtype.');
        }

        $size = $this->normalizeSize($input['size'] ?? null);
        if ($size === null) {
            throw new \InvalidArgumentException('Velg størrelse.');
        }

        $quantity = $this->normalizeMaxCount($input['quantity'] ?? 0);
        $duplicate = $this->crewClothing->findInventoryByTypeAndSize($itemType, $size);
        if ($duplicate !== null && (int) ($duplicate['id'] ?? 0) !== $inventoryId) {
            throw new \InvalidArgumentException('Det finnes allerede en varelinje for denne plaggtypen og størrelsen.');
        }

        $data = [
            'item_type' => $itemType,
            'size' => $size,
            'quantity' => $quantity,
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        $this->crewClothing->updateInventoryById($inventoryId, $data);
        $this->audit->log($actorUserId, 'update', 'crew_clothing_inventory', $inventoryId, $data);
    }

    public function deleteInventory(int $inventoryId, int $actorUserId): void
    {
        $existing = $this->crewClothing->findInventoryById($inventoryId);
        if ($existing === null) {
            throw new \InvalidArgumentException('Varelinjen finnes ikke.');
        }

        $this->crewClothing->deleteInventoryById($inventoryId);
        $this->audit->log($actorUserId, 'delete', 'crew_clothing_inventory', $inventoryId, [
            'item_type' => $existing['item_type'] ?? null,
            'size' => $existing['size'] ?? null,
            'quantity' => $existing['quantity'] ?? null,
        ]);
    }

    private function lookupOrCreateMember(string $query): array
    {
        $query = trim($query);
        if ($query === '') {
            throw new \InvalidArgumentException('Scan badge eller skriv inn Wannabe ID.');
        }

        $profile = null;
        if (ctype_digit($query)) {
            $profile = $this->crewDirectory->profileByWannabeId((int) $query);
            if (! is_array($profile)) {
                $profile = $this->crewDirectory->profileByBadge($query);
            }
        } else {
            $profile = $this->crewDirectory->profileByBadge($query);
        }

        if (! is_array($profile)) {
            $profile = $this->fallbackProfile($query);
        }

        if (! is_array($profile)) {
            throw new \InvalidArgumentException('Fant ikke crewmedlem for dette oppslaget.');
        }

        $wannabeId = max(0, (int) ($profile['id'] ?? 0));
        $badgeScanNumber = ! ctype_digit($query) ? mb_substr($query, 0, 120) : null;
        $crewName = mb_substr(trim((string) ($profile['crew_name'] ?? $profile['crew'] ?? '')), 0, 120);
        $name = $this->resolveProfileName($profile);
        $nickname = mb_substr(trim((string) ($profile['nickname'] ?? $profile['nick'] ?? '')), 0, 120);

        $existing = $wannabeId > 0 ? $this->crewClothing->findMemberByWannabeId($wannabeId) : null;
        if ($existing === null && $badgeScanNumber !== null && $badgeScanNumber !== '') {
            $existing = $this->crewClothing->findMemberByBadgeScanNumber($badgeScanNumber);
        }

        $crewId = null;
        if ($crewName !== '') {
            $crewId = $this->resolveCrewId($crewName);
        } elseif ($existing !== null && ! empty($existing['crew_id'])) {
            $crewId = (int) $existing['crew_id'];
        }

        $data = [
            'crew_id' => $crewId,
            'wannabe_id' => $wannabeId > 0 ? $wannabeId : ($existing['wannabe_id'] ?? null),
            'badge_scan_number' => $badgeScanNumber !== null && $badgeScanNumber !== '' ? $badgeScanNumber : ($existing['badge_scan_number'] ?? null),
            'name' => $name,
            'nickname' => $nickname !== '' ? $nickname : ($existing['nickname'] ?? null),
            'updated_at' => date('Y-m-d H:i:s'),
        ];

        if ($existing === null) {
            $memberId = $this->crewClothing->createMember([
                ...$data,
                'tshirt_size' => null,
                'tshirt_delivered' => 0,
                'tshirt_delivered_at' => null,
                'tshirt_delivered_by_user_id' => null,
                'hoodie_size' => null,
                'hoodie_delivered' => 0,
                'hoodie_delivered_at' => null,
                'hoodie_delivered_by_user_id' => null,
                'created_at' => date('Y-m-d H:i:s'),
            ]);

            return $this->crewClothing->findMemberById($memberId) ?? [];
        }

        $this->crewClothing->updateMemberById((int) $existing['id'], $data);

        return $this->crewClothing->findMemberById((int) $existing['id']) ?? [];
    }

    private function fallbackProfile(string $query): ?array
    {
        $user = null;
        if (ctype_digit($query)) {
            $user = $this->users->findByWannabeId((int) $query);
            if ($user === null) {
                $user = $this->users->findByBadgeScanNumber($query);
            }
        } else {
            $user = $this->users->findByBadgeScanNumber($query);
        }

        if ($user === null) {
            return null;
        }

        $name = trim((string) ($user->name ?? (($user->first_name ?? '') . ' ' . ($user->last_name ?? ''))));
        if ($name === '') {
            $name = 'Ukjent crewmedlem';
        }

        return [
            'id' => (int) ($user->wannabe_id ?? 0),
            'name' => $name,
            'nickname' => '',
            'crew_name' => '',
        ];
    }

    private function resolveProfileName(array $profile): string
    {
        $name = trim((string) ($profile['name'] ?? $profile['displayName'] ?? ''));
        if ($name !== '') {
            return mb_substr($name, 0, 180);
        }

        $nickname = trim((string) ($profile['nickname'] ?? $profile['nick'] ?? ''));
        if ($nickname !== '') {
            return mb_substr($nickname, 0, 180);
        }

        $wannabeId = max(0, (int) ($profile['id'] ?? 0));

        return $wannabeId > 0 ? 'Wannabe ' . $wannabeId : 'Ukjent crewmedlem';
    }

    private function resolveCrewId(string $crewName): int
    {
        $existing = $this->crewClothing->findCrewByName($crewName);
        if ($existing !== null) {
            return (int) $existing['id'];
        }

        return $this->crewClothing->createCrew([
            'name' => $crewName,
            'tshirt_max' => 1,
            'hoodie_max' => 1,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    private function normalizeSize(mixed $size): ?string
    {
        $size = mb_strtoupper(trim(strip_tags((string) $size)));
        if ($size === '') {
            return null;
        }

        if (! in_array($size, self::SIZE_OPTIONS, true)) {
            throw new \InvalidArgumentException('Ugyldig størrelse.');
        }

        return $size;
    }

    private function normalizeMaxCount(mixed $value): int
    {
        return max(0, (int) $value);
    }
}
