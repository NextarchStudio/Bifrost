<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRepository;
use App\Repositories\PrivateEquipmentRepository;

class PrivateEquipmentService
{
    public function __construct(
        private readonly PrivateEquipmentRepository $prefixes = new PrivateEquipmentRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function pageData(): array
    {
        $rows = [];

        foreach ($this->prefixes->all() as $prefix) {
            $prefixValue = (string) ($prefix['barcode_prefix'] ?? '');
            $equipmentItems = array_map(static fn (object $item): array => [
                'id' => (int) ($item->id ?? 0),
                'name' => (string) ($item->name ?? '-'),
                'serial_number' => (string) ($item->serial_number ?? '-'),
                'quantity' => (int) ($item->quantity ?? 0),
                'status' => (string) ($item->status ?? '-'),
            ], $this->equipment->findBySerialPrefix($prefixValue));
            $range = $this->equipment->serialRangeByPrefix($prefixValue);

            $rows[] = [
                ...$prefix,
                'equipment_items' => $equipmentItems,
                'equipment_count' => count($equipmentItems),
                'lowest_serial' => $range['lowest_serial'] ?? null,
                'highest_serial' => $range['highest_serial'] ?? null,
            ];
        }

        return [
            'prefixes' => $rows,
        ];
    }

    public function create(array $input, int $actorUserId): int
    {
        $ownerName = trim((string) ($input['owner_name'] ?? ''));
        $prefix = strtoupper(trim((string) ($input['barcode_prefix'] ?? '')));

        if ($ownerName === '') {
            throw new \InvalidArgumentException('Legg inn navn på eier.');
        }

        if ($prefix === '') {
            throw new \InvalidArgumentException('Legg inn hva strekkoden starter på.');
        }

        if (! preg_match('/^[A-Z0-9._-]+$/', $prefix)) {
            throw new \InvalidArgumentException('Strekkodeprefiks kan bare inneholde bokstaver, tall, bindestrek, understrek og punktum.');
        }

        if ($this->prefixes->findByPrefix($prefix) !== null) {
            throw new \InvalidArgumentException('Dette prefikset finnes allerede.');
        }

        $now = date('Y-m-d H:i:s');
        $id = $this->prefixes->create([
            'owner_name' => mb_substr($ownerName, 0, 180),
            'barcode_prefix' => $prefix,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        $this->audit->log($actorUserId, 'create', 'private_equipment_prefix', $id, [
            'owner_name' => $ownerName,
            'barcode_prefix' => $prefix,
        ]);

        return $id;
    }

    public function delete(int $id, int $actorUserId): void
    {
        if ($id < 1) {
            throw new \InvalidArgumentException('Ugyldig privat utstyr-regel.');
        }

        $this->prefixes->deleteById($id);
        $this->audit->log($actorUserId, 'delete', 'private_equipment_prefix', $id);
    }

    public function loanNoticeRules(): array
    {
        return array_map(static function (array $prefix): array {
            $ownerName = trim((string) ($prefix['owner_name'] ?? ''));
            $prefixValue = strtoupper(trim((string) ($prefix['barcode_prefix'] ?? '')));

            return [
                'owner_name' => $ownerName,
                'prefix' => $prefixValue,
                'return_message' => sprintf('Dette er en eiendel av %s. Gi eiendelen til %s.', $ownerName, $ownerName),
                'issue_message' => sprintf('Dette er en eiendel av %s. Bekreft at du har blitt spurt før den lånes ut.', $ownerName),
            ];
        }, $this->prefixes->all());
    }
}
