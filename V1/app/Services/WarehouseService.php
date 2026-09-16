<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRepository;
use App\Repositories\WarehouseRepository;

class WarehouseService
{
    public function __construct(
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function data(): array
    {
        return [
            'locations' => $this->warehouse->locations(),
            'palletLocations' => $this->warehouse->palletEligibleLocations(),
            'pallets'   => $this->warehouse->palletsWithLocation(),
            'slots'     => $this->warehouse->slotsWithPallet(),
        ];
    }

    public function createLocation(array $input, int $actorUserId): int
    {
        $rules = ['name' => 'required|max_length[120]', 'type' => 'required|max_length[50]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig location.');
        }
        $id = $this->warehouse->createLocation([
            'name' => mb_substr(strip_tags((string) $input['name']), 0, 120),
            'type' => mb_substr(strip_tags((string) $input['type']), 0, 50),
        ]);
        $this->audit->log($actorUserId, 'create', 'location', $id, $input);

        return $id;
    }

    public function createPallet(array $input, int $actorUserId): int
    {
        $rules = ['location_id' => 'required|integer', 'pallet_number' => 'required|max_length[80]', 'qr_code' => 'required|max_length[120]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig pallet.');
        }
        $location = $this->warehouse->findLocationById((int) $input['location_id']);
        if ($location === null) {
            throw new \InvalidArgumentException('Lokasjon finnes ikke.');
        }
        if (mb_strtolower((string) $location->type) === 'transport') {
            throw new \InvalidArgumentException('Kan ikke opprette palle på lokasjonstype Transport.');
        }
        $qrCode = mb_substr(trim(strip_tags((string) $input['qr_code'])), 0, 120);
        if ($this->warehouse->findPalletByQrCode($qrCode) !== null) {
            throw new \InvalidArgumentException('Strekkode er allerede i bruk på en annen palle.');
        }
        $palletNumber = mb_substr(trim(strip_tags((string) $input['pallet_number'])), 0, 80);
        if ($palletNumber === '') {
            throw new \InvalidArgumentException('Palle nummer er påkrevd.');
        }

        $id = $this->warehouse->createPallet([
            'location_id' => (int) $input['location_id'],
            'name'        => $palletNumber,
            'qr_code'     => $qrCode,
        ]);
        $this->audit->log($actorUserId, 'create', 'pallet', $id, [
            'location_id' => (int) $input['location_id'],
            'pallet_number' => $palletNumber,
            'qr_code' => $qrCode,
        ]);

        return $id;
    }

    public function createSlot(array $input, int $actorUserId): int
    {
        $rules = ['pallet_id' => 'required|integer', 'slot_number' => 'required|integer', 'status' => 'required|max_length[20]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig slot.');
        }
        $id = $this->warehouse->createSlot([
            'pallet_id'   => (int) $input['pallet_id'],
            'slot_number' => (int) $input['slot_number'],
            'status'      => mb_substr(strip_tags((string) $input['status']), 0, 20),
        ]);
        $this->audit->log($actorUserId, 'create', 'pallet_slot', $id, $input);

        return $id;
    }

    public function inspectPallet(int $palletId): array
    {
        $pallet = $this->warehouse->findPalletById($palletId);
        if ($pallet === null) {
            throw new \InvalidArgumentException('Palle finnes ikke.');
        }

        return [
            'pallet' => $pallet,
            'rows'   => $this->warehouse->palletSlotsWithEquipment($palletId),
        ];
    }

    public function deletePallet(int $palletId, int $actorUserId): void
    {
        $pallet = $this->warehouse->findPalletById($palletId);
        if ($pallet === null) {
            throw new \InvalidArgumentException('Palle finnes ikke.');
        }
        $equipmentCount = $this->warehouse->countEquipmentOnPallet($palletId);
        if ($equipmentCount > 0) {
            throw new \InvalidArgumentException('Palle kan ikke slettes fordi den inneholder utstyr.');
        }

        $this->warehouse->deletePalletById($palletId);
        $this->audit->log($actorUserId, 'delete', 'pallet', $palletId, ['name' => (string) $pallet->name]);
    }

    public function addEquipmentToPallet(array $input, int $actorUserId): void
    {
        $rules = [
            'pallet_qr_code'     => 'required|max_length[120]',
            'equipment_barcode'  => 'required|max_length[150]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig strekkode.');
        }

        $palletQrCode = mb_substr(trim(strip_tags((string) $input['pallet_qr_code'])), 0, 120);
        $equipmentBarcode = mb_substr(trim(strip_tags((string) $input['equipment_barcode'])), 0, 150);

        $pallet = $this->warehouse->findPalletByQrCode($palletQrCode);
        if ($pallet === null) {
            throw new \InvalidArgumentException('Palle med strekkode finnes ikke.');
        }
        $item = $this->equipment->findBySerialNumber($equipmentBarcode);
        if ($item === null) {
            throw new \InvalidArgumentException('Utstyr med strekkode finnes ikke.');
        }

        // Intern standardslot per palle for kompatibilitet med eksisterende datastruktur.
        $slot = $this->warehouse->findSlotByPalletAndNumber((int) $pallet->id, 1);
        $slotId = $slot !== null
            ? (int) $slot->id
            : $this->warehouse->createSlot([
                'pallet_id'   => (int) $pallet->id,
                'slot_number' => 1,
                'status'      => 'available',
            ]);

        $this->equipment->updateById((int) $item->id, [
            'pallet_slot_id' => $slotId,
            'updated_at'     => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'move_by_barcode', 'equipment', (int) $item->id, [
            'equipment_barcode' => $equipmentBarcode,
            'pallet_qr_code'    => $palletQrCode,
            'pallet_id'         => (int) $pallet->id,
        ]);
    }

    public function movePallet(int $palletId, int $locationId, int $actorUserId): void
    {
        $pallet = $this->warehouse->findPalletById($palletId);
        if ($pallet === null) {
            throw new \InvalidArgumentException('Palle finnes ikke.');
        }

        $location = $this->warehouse->findLocationById($locationId);
        if ($location === null) {
            throw new \InvalidArgumentException('Lokasjon finnes ikke.');
        }
        if (mb_strtolower((string) $location->type) === 'transport') {
            throw new \InvalidArgumentException('Palle kan ikke flyttes til lokasjonstype Transport.');
        }

        $this->warehouse->updatePalletById($palletId, ['location_id' => $locationId]);
        $this->audit->log($actorUserId, 'move', 'pallet', $palletId, [
            'from_location_id' => (int) $pallet->location_id,
            'to_location_id' => $locationId,
        ]);
    }
}
