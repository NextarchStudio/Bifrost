<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRepository;
use App\Repositories\EquipmentRequestRepository;
use App\Repositories\LoanRepository;
use App\Repositories\UserRepository;
use Config\Database;

class EquipmentRequestService
{
    public function __construct(
        private readonly EquipmentRequestRepository $requests = new EquipmentRequestRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly LoanRepository $loans = new LoanRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function equipmentForSelection(): array
    {
        $all = $this->equipment->allWithContext();

        return array_values(array_filter($all, static fn (object $item): bool => (string) $item->status !== 'maintenance'));
    }

    public function mine(int $userId): array
    {
        $requests = $this->requests->mineWithSummary($userId);

        foreach ($requests as &$request) {
            $items = $this->requests->requestItems((int) $request['id']);
            $changes = [];
            foreach ($items as $item) {
                $requestedQty = (int) ($item['quantity'] ?? 0);
                $approvedQty = (int) ($item['approved_quantity'] ?? 0);
                $itemStatus = (string) ($item['item_status'] ?? 'pending');

                if ($itemStatus === 'pending' || $approvedQty >= $requestedQty) {
                    continue;
                }

                $changes[] = sprintf(
                    '%s %d/%d',
                    (string) ($item['equipment_name'] ?? 'Utstyr'),
                    $approvedQty,
                    $requestedQty
                );
            }

            $request['change_summary'] = $changes !== [] ? implode(', ', $changes) : null;
        }
        unset($request);

        return $requests;
    }

    public function allForLogistics(): array
    {
        $requests = $this->requests->allWithSummary();
        foreach ($requests as &$request) {
            $request['items'] = $this->requests->requestItems((int) $request['id']);
        }
        unset($request);

        return $requests;
    }

    public function currentWannabeIdForUser(int $userId): ?int
    {
        $user = $this->users->findById($userId);
        if ($user === null || $user->wannabe_id === null) {
            return null;
        }

        return (int) $user->wannabe_id;
    }

    public function create(array $input, int $requesterUserId): int
    {
        $parsedItems = $this->parseItems((array) ($input['items'] ?? []));
        if ($parsedItems === []) {
            throw new \InvalidArgumentException('Velg minst ett utstyr i listen.');
        }

        $wannabeId = $this->currentWannabeIdForUser($requesterUserId);
        if ($wannabeId === null || $wannabeId < 1) {
            throw new \InvalidArgumentException('Du mangler wannabe-id på brukerprofilen. Kontakt administrator.');
        }

        $now = date('Y-m-d H:i:s');
        $requestId = $this->requests->createRequest([
            'requester_user_id' => $requesterUserId,
            'wannabe_id'        => $wannabeId,
            'title'             => 'Utstyrsforespørsel #' . $wannabeId . ' (' . date('d.m.Y H:i') . ')',
            'notes'             => null,
            'status'            => 'pending',
            'created_at'        => $now,
            'updated_at'        => $now,
        ]);

        foreach ($parsedItems as $item) {
            $this->requests->addItem([
                'request_id'   => $requestId,
                'equipment_id' => $item['equipment_id'],
                'quantity'     => $item['quantity'],
                'note'         => $item['note'],
            ]);
        }

        $this->audit->log($requesterUserId, 'create', 'equipment_request', $requestId, ['items' => $parsedItems]);

        return $requestId;
    }

    public function delete(int $requestId, int $actorUserId, bool $canManageRequests): void
    {
        $request = $this->requests->findRequestById($requestId);
        if ($request === null) {
            throw new \InvalidArgumentException('Forespørsel ikke funnet.');
        }

        $isOwner = (int) ($request['requester_user_id'] ?? 0) === $actorUserId;
        if (! $isOwner && ! $canManageRequests) {
            throw new \InvalidArgumentException('Du kan ikke slette denne forespørselen.');
        }

        $status = (string) ($request['status'] ?? 'pending');
        if (! $canManageRequests && ! in_array($status, ['pending', 'rejected', 'returned'], true)) {
            throw new \InvalidArgumentException('Du kan bare slette egne forespørsler som er ventende, avvist eller returnert.');
        }

        if ($this->loans->activeCountByRequestId($requestId) > 0) {
            throw new \InvalidArgumentException('Forespørsel kan ikke slettes mens det finnes aktive utlån knyttet til den.');
        }

        $db = Database::connect();
        $db->transStart();
        $this->requests->deleteItemsByRequestId($requestId);
        $this->requests->deleteRequestById($requestId);
        $db->transComplete();

        if (! $db->transStatus()) {
            throw new \RuntimeException('Forespørsel kunne ikke slettes.');
        }

        $this->audit->log($actorUserId, 'delete', 'equipment_request', $requestId, [
            'status' => $status,
            'requester_user_id' => (int) ($request['requester_user_id'] ?? 0),
        ]);
    }

    public function updateStatus(int $requestId, string $status, int $actorUserId): void
    {
        $status = mb_substr(strip_tags(trim($status)), 0, 20);
        if (! in_array($status, ['pending', 'rejected', 'fulfilled'], true)) {
            throw new \InvalidArgumentException('Ugyldig status.');
        }
        $this->requests->updateStatus($requestId, $status);
        $this->audit->log($actorUserId, 'status', 'equipment_request', $requestId, ['status' => $status]);
    }

    public function approveAll(int $requestId, int $actorUserId): void
    {
        $items = $this->requests->requestItems($requestId);
        if ($items === []) {
            throw new \InvalidArgumentException('Forespørsel har ingen linjer.');
        }

        $approvedQuantities = [];
        foreach ($items as $item) {
            $approvedQuantities[(int) $item['id']] = max(1, (int) $item['quantity']);
        }

        $this->approvePartial($requestId, $approvedQuantities, [], $actorUserId);
    }

    /**
     * @param array<int,int> $approvedQuantities
     * @param list<int> $rejectedItemIds
     */
    public function approvePartial(int $requestId, array $approvedQuantities, array $rejectedItemIds, int $actorUserId): void
    {
        $request = $this->requests->findRequestById($requestId);
        if ($request === null) {
            throw new \InvalidArgumentException('Forespørsel ikke funnet.');
        }
        $wannabeId = (int) ($request['wannabe_id'] ?? 0);
        if ($wannabeId < 1) {
            throw new \InvalidArgumentException('Forespørsel mangler wannabe-id.');
        }

        $items = $this->requests->requestItems($requestId);
        if ($items === []) {
            throw new \InvalidArgumentException('Forespørsel har ingen linjer.');
        }

        $approvedCount = 0;
        $rejectedCount = 0;
        $pendingCount = 0;

        foreach ($items as $item) {
            $itemId = (int) $item['id'];
            $equipmentId = (int) $item['equipment_id'];
            $requestedQty = max(1, (int) $item['quantity']);
            $currentApprovedQty = max(0, (int) ($item['approved_quantity'] ?? 0));
            $targetApprovedQty = max(0, (int) ($approvedQuantities[$itemId] ?? $currentApprovedQty));
            $targetApprovedQty = min($targetApprovedQty, $requestedQty);

            if ($targetApprovedQty > 0) {
                $deltaToApprove = max(0, $targetApprovedQty - $currentApprovedQty);
                $approvedDelta = $deltaToApprove > 0 ? $this->equipment->reduceQuantity($equipmentId, $deltaToApprove) : 0;
                $newApprovedQty = $currentApprovedQty + $approvedDelta;

                if ($approvedDelta > 0) {
                    $this->loans->addRequestQuantity($requestId, $equipmentId, $wannabeId, $actorUserId, $approvedDelta);
                }

                if ($newApprovedQty > 0) {
                    $this->requests->updateItem($itemId, [
                        'approved_quantity' => $newApprovedQty,
                        'item_status'       => $newApprovedQty >= $requestedQty ? 'approved' : 'partial',
                    ]);
                    $approvedCount++;
                } else {
                    $this->requests->updateItem($itemId, [
                        'approved_quantity' => 0,
                        'item_status'       => 'pending',
                    ]);
                    $pendingCount++;
                }
                continue;
            }

            if (in_array($itemId, $rejectedItemIds, true) && $currentApprovedQty === 0) {
                $this->requests->updateItem($itemId, [
                    'approved_quantity' => 0,
                    'item_status'       => 'rejected',
                ]);
                $rejectedCount++;
                continue;
            }

            $pendingCount++;
        }

        $requestStatus = 'pending';
        if ($approvedCount > 0 && ($pendingCount > 0 || $rejectedCount > 0)) {
            $requestStatus = 'partial';
        } elseif ($approvedCount > 0 && $pendingCount === 0 && $rejectedCount === 0) {
            $requestStatus = 'approved';
        } elseif ($approvedCount === 0 && $pendingCount === 0 && $rejectedCount > 0) {
            $requestStatus = 'rejected';
        }

        $this->requests->setRequestStatus($requestId, $requestStatus);
        $this->audit->log($actorUserId, 'approve_partial', 'equipment_request', $requestId, [
            'approved_quantities' => $approvedQuantities,
            'rejected_item_ids' => array_values($rejectedItemIds),
            'result_status'     => $requestStatus,
        ]);
    }

    /**
     * @param array<string, array<string, mixed>> $items
     * @return list<array{equipment_id:int,quantity:int,note:?string}>
     */
    private function parseItems(array $items): array
    {
        $result = [];
        foreach ($items as $equipmentId => $payload) {
            if (! isset($payload['selected'])) {
                continue;
            }
            $equipmentId = (int) $equipmentId;
            if ($equipmentId < 1 || $this->equipment->findById($equipmentId) === null) {
                continue;
            }
            if (! $this->equipment->isAvailable($equipmentId)) {
                continue;
            }
            $quantity = isset($payload['quantity']) ? (int) $payload['quantity'] : 1;
            $quantity = max(1, min(100, $quantity));
            $note = isset($payload['note']) && $payload['note'] !== ''
                ? mb_substr(strip_tags((string) $payload['note']), 0, 255)
                : null;
            $result[] = [
                'equipment_id' => $equipmentId,
                'quantity'     => $quantity,
                'note'         => $note,
            ];
        }

        return $result;
    }
}