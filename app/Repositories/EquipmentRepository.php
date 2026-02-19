<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\EquipmentModel;

class EquipmentRepository
{
    public function __construct(private readonly EquipmentModel $equipment = new EquipmentModel())
    {
    }

    public function allWithContext(): array
    {
        return $this->equipment
            ->select('equipment.*, pallet_slots.slot_number, pallets.name AS pallet_name, locations.id AS location_id, locations.name AS location_name')
            ->select('(SELECT COALESCE(SUM(el.quantity), 0)
                FROM equipment_loans el
                WHERE el.equipment_id = equipment.id
                  AND el.status = \'active\') AS loaned_quantity', false)
            ->select('(SELECT GROUP_CONCAT(DISTINCT l2.name ORDER BY l2.name SEPARATOR ", ")
                FROM equipment e2
                LEFT JOIN pallet_slots ps2 ON ps2.id = e2.pallet_slot_id
                LEFT JOIN pallets p2 ON p2.id = ps2.pallet_id
                LEFT JOIN locations l2 ON l2.id = p2.location_id
                WHERE e2.name = equipment.name AND l2.name IS NOT NULL) AS location_names', false)
            ->join('pallet_slots', 'pallet_slots.id = equipment.pallet_slot_id', 'left')
            ->join('pallets', 'pallets.id = pallet_slots.pallet_id', 'left')
            ->join('locations', 'locations.id = pallets.location_id', 'left')
            ->orderBy('equipment.name', 'ASC')
            ->findAll();
    }

    public function findById(int $id): ?object
    {
        return $this->equipment->find($id);
    }

    public function findBySerialNumber(string $serialNumber): ?object
    {
        $serialNumber = trim($serialNumber);
        if ($serialNumber == '') {
            return null;
        }

        return $this->equipment
            ->where('serial_number', $serialNumber)
            ->first();
    }

    public function create(array $data): int
    {
        $this->equipment->insert($data);

        return (int) $this->equipment->getInsertID();
    }

    public function updateById(int $id, array $data): bool
    {
        return $this->equipment->update($id, $data);
    }

    public function isAvailable(int $id): bool
    {
        $row = $this->equipment
            ->select('status, quantity')
            ->where('id', $id)
            ->first();

        return $row !== null
            && (string) $row->status !== 'maintenance'
            && (int) $row->quantity > 0;
    }

    public function quantity(int $id): int
    {
        $row = $this->equipment
            ->select('quantity')
            ->where('id', $id)
            ->first();

        return $row !== null ? (int) $row->quantity : 0;
    }

    public function reduceQuantity(int $id, int $amount): int
    {
        $amount = max(1, $amount);
        $item = $this->findById($id);
        if ($item === null) {
            return 0;
        }

        $current = max(0, (int) $item->quantity);
        $approved = min($current, $amount);
        $newQty = $current - $approved;
        $newStatus = $newQty > 0 ? 'available' : 'loaned';

        $this->updateById($id, [
            'quantity'   => $newQty,
            'status'     => $newStatus,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        return $approved;
    }

    public function increaseQuantity(int $id, int $amount): void
    {
        $amount = max(1, $amount);
        $item = $this->findById($id);
        if ($item === null) {
            return;
        }

        $newQty = max(0, (int) $item->quantity) + $amount;
        $this->updateById($id, [
            'quantity'   => $newQty,
            'status'     => 'available',
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public function countByCategoryName(string $categoryName): int
    {
        return (int) $this->equipment
            ->where('category', $categoryName)
            ->countAllResults();
    }

    public function countLoanReferences(int $equipmentId): int
    {
        return (int) $this->equipment->db
            ->table('equipment_loans')
            ->where('equipment_id', $equipmentId)
            ->countAllResults();
    }

    public function countRequestReferences(int $equipmentId): int
    {
        return (int) $this->equipment->db
            ->table('equipment_request_items')
            ->where('equipment_id', $equipmentId)
            ->countAllResults();
    }

    public function deleteById(int $id): bool
    {
        return $this->equipment->delete($id);
    }

    public function belongsToLocation(int $equipmentId, int $locationId): bool
    {
        if ($equipmentId < 1 || $locationId < 1) {
            return false;
        }

        $row = $this->equipment
            ->select('equipment.id')
            ->join('pallet_slots', 'pallet_slots.id = equipment.pallet_slot_id', 'left')
            ->join('pallets', 'pallets.id = pallet_slots.pallet_id', 'left')
            ->where('equipment.id', $equipmentId)
            ->where('pallets.location_id', $locationId)
            ->first();

        return $row !== null;
    }
}
