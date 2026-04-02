<?php
declare(strict_types=1);

namespace App\Repositories;

use App\Models\EquipmentRequestItemModel;
use App\Models\EquipmentRequestModel;

class EquipmentRequestRepository
{
    public function __construct(
        private readonly EquipmentRequestModel $requests = new EquipmentRequestModel(),
        private readonly EquipmentRequestItemModel $items = new EquipmentRequestItemModel()
    ) {
    }

    public function createRequest(array $data): int
    {
        $this->requests->insert($data);

        return (int) $this->requests->getInsertID();
    }

    public function addItem(array $data): void
    {
        $this->items->insert($data);
    }

    public function requestItems(int $requestId): array
    {
        return $this->items
            ->select('equipment_request_items.*, equipment.name AS equipment_name, equipment.serial_number, equipment.status AS equipment_status, equipment.quantity AS equipment_quantity')
            ->join('equipment', 'equipment.id = equipment_request_items.equipment_id', 'inner')
            ->where('equipment_request_items.request_id', $requestId)
            ->orderBy('equipment_request_items.id', 'ASC')
            ->findAll();
    }

    public function findRequestById(int $requestId): ?array
    {
        return $this->requests
            ->where('id', $requestId)
            ->first();
    }

    public function updateItem(int $itemId, array $data): bool
    {
        return $this->items->update($itemId, $data);
    }

    public function setRequestStatus(int $requestId, string $status): bool
    {
        return $this->requests->update($requestId, [
            'status'     => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public function mineWithSummary(int $userId): array
    {
        return $this->requests
            ->select("equipment_requests.*, users.name AS wannabe_name, users.first_name AS wannabe_first_name, users.last_name AS wannabe_last_name, GROUP_CONCAT(CONCAT(equipment.name, ' x', equipment_request_items.quantity) SEPARATOR ', ') AS items_summary")
            ->join('users', 'users.wannabe_id = equipment_requests.wannabe_id', 'left')
            ->join('equipment_request_items', 'equipment_request_items.request_id = equipment_requests.id', 'left')
            ->join('equipment', 'equipment.id = equipment_request_items.equipment_id', 'left')
            ->where('equipment_requests.requester_user_id', $userId)
            ->where('equipment_requests.status !=', 'returned')
            ->groupBy('equipment_requests.id')
            ->orderBy('equipment_requests.created_at', 'DESC')
            ->findAll();
    }

    public function allWithSummary(): array
    {
        return $this->requests
            ->select("equipment_requests.*, users.name AS requester_name, wannabe_user.name AS wannabe_name, wannabe_user.first_name AS wannabe_first_name, wannabe_user.last_name AS wannabe_last_name, GROUP_CONCAT(CONCAT(equipment.name, ' x', equipment_request_items.quantity) SEPARATOR ', ') AS items_summary")
            ->join('users', 'users.id = equipment_requests.requester_user_id', 'inner')
            ->join('users AS wannabe_user', 'wannabe_user.wannabe_id = equipment_requests.wannabe_id', 'left')
            ->join('equipment_request_items', 'equipment_request_items.request_id = equipment_requests.id', 'left')
            ->join('equipment', 'equipment.id = equipment_request_items.equipment_id', 'left')
            ->where('equipment_requests.status !=', 'rejected')
            ->where('equipment_requests.status !=', 'fulfilled')
            ->where('equipment_requests.status !=', 'returned')
            ->groupBy('equipment_requests.id')
            ->orderBy('equipment_requests.created_at', 'DESC')
            ->findAll();
    }

    public function deleteItemsByRequestId(int $requestId): bool
    {
        return $this->items
            ->where('request_id', $requestId)
            ->delete();
    }

    public function deleteRequestById(int $requestId): bool
    {
        return $this->requests->delete($requestId);
    }

    public function updateStatus(int $requestId, string $status): bool
    {
        return $this->requests->update($requestId, [
            'status'     => $status,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);
    }

    public function isDelivered(int $requestId): bool
    {
        $row = $this->requests->select('status')->where('id', $requestId)->first();

        return $row !== null && (string) $row['status'] === 'fulfilled';
    }
}