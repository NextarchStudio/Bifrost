<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRepository;
use App\Repositories\WarehouseRepository;

class InventoryService
{
    public function __construct(
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function list(): array
    {
        return $this->equipment->allWithContext();
    }

    public function create(array $input, int $actorUserId): int
    {
        $data = $this->validateCreate($input);
        $id = $this->equipment->create([
            ...$data,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'create', 'equipment', $id, $data);

        return $id;
    }

    public function move(int $equipmentId, array $input, int $actorUserId): void
    {
        $rules = ['pallet_qr_code' => 'required|max_length[120]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig palle-strekkode.');
        }

        $item = $this->equipment->findById($equipmentId);
        if ($item === null) {
            throw new \InvalidArgumentException('Utstyr finnes ikke.');
        }

        $palletQrCode = mb_substr(trim(strip_tags((string) $input['pallet_qr_code'])), 0, 120);
        $pallet = $this->warehouse->findPalletByQrCode($palletQrCode);
        if ($pallet === null) {
            throw new \InvalidArgumentException('Palle med strekkode finnes ikke.');
        }

        $slot = $this->warehouse->findSlotByPalletAndNumber((int) $pallet->id, 1);
        $slotId = $slot !== null
            ? (int) $slot->id
            : $this->warehouse->createSlot([
                'pallet_id'   => (int) $pallet->id,
                'slot_number' => 1,
                'status'      => 'available',
            ]);

        $this->equipment->updateById($equipmentId, [
            'pallet_slot_id' => $slotId,
            'updated_at'     => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'move', 'equipment', $equipmentId, [
            'pallet_slot_id' => $slotId,
            'pallet_qr_code' => $palletQrCode,
        ]);
    }

    public function changeStatus(int $equipmentId, string $status, int $actorUserId): void
    {
        $status = mb_substr(strip_tags(trim($status)), 0, 30);
        $this->equipment->updateById($equipmentId, [
            'status'     => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
        $this->audit->log($actorUserId, 'status', 'equipment', $equipmentId, ['status' => $status]);
    }

    public function delete(int $equipmentId, int $actorUserId): void
    {
        $item = $this->equipment->findById($equipmentId);
        if ($item === null) {
            throw new \InvalidArgumentException('Utstyr finnes ikke.');
        }

        $loanRefs = $this->equipment->countLoanReferences($equipmentId);
        $requestRefs = $this->equipment->countRequestReferences($equipmentId);
        if ($loanRefs > 0 || $requestRefs > 0) {
            throw new \InvalidArgumentException('Utstyr kan ikke slettes fordi det er koblet til utlån eller forespørsler.');
        }

        $this->equipment->deleteById($equipmentId);
        $this->audit->log($actorUserId, 'delete', 'equipment', $equipmentId, ['name' => (string) $item->name]);
    }

    private function validateCreate(array $input): array
    {
        $rules = [
            'name'          => 'required|min_length[2]|max_length[150]',
            'category'      => 'required|min_length[2]|max_length[80]',
            'serial_number' => 'required|min_length[2]|max_length[150]',
            'quantity'      => 'required|integer|greater_than_equal_to[1]',
            'notes'         => 'permit_empty|max_length[4000]',
        ];

        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        return [
            'name'           => mb_substr(strip_tags((string) $input['name']), 0, 150),
            'category'       => mb_substr(strip_tags((string) $input['category']), 0, 80),
            'serial_number'  => mb_substr(strip_tags((string) $input['serial_number']), 0, 150),
            'quantity'       => (int) $input['quantity'],
            'status'         => 'available',
            'pallet_slot_id' => null,
            'notes'          => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 4000) : null,
        ];
    }
}
