<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\EquipmentRepository;
use App\Repositories\EquipmentRequestRepository;
use App\Repositories\LoanRepository;

class LoanService
{
    public function __construct(
        private readonly LoanRepository $loans = new LoanRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository(),
        private readonly EquipmentRequestRepository $requests = new EquipmentRequestRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function active(?string $search = null): array
    {
        return $this->loans->activeLoans($search);
    }

    public function issue(array $input, int $actorUserId): int
    {
        $rules = ['barcode' => 'required|max_length[150]', 'wannabe_id' => 'required|integer|greater_than[0]'];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig lån.');
        }
        $barcode = trim((string) $input['barcode']);
        $equipment = $this->equipment->findBySerialNumber($barcode);
        if ($equipment === null) {
            throw new \InvalidArgumentException('Ugyldig strekkode/serienummer.');
        }
        $equipmentId = (int) $equipment->id;
        if (! $this->equipment->isAvailable($equipmentId)) {
            throw new \InvalidArgumentException('Utstyret er ikke tilgjengelig på lager.');
        }
        $id = $this->loans->create([
            'equipment_id'      => $equipmentId,
            'wannabe_id'        => (int) $input['wannabe_id'],
            'quantity'          => 1,
            'issued_by_user_id' => $actorUserId,
            'issued_at'         => date('Y-m-d H:i:s'),
            'returned_at'       => null,
            'status'            => 'active',
        ]);
        $this->equipment->reduceQuantity($equipmentId, 1);
        $this->audit->log($actorUserId, 'issue', 'equipment_loan', $id, $input);

        return $id;
    }

    public function returnLoan(int $loanId, int $actorUserId): void
    {
        $loan = $this->loans->findById($loanId);
        if ($loan === null) {
            throw new \InvalidArgumentException('Lån ikke funnet.');
        }
        $this->loans->updateById($loanId, [
            'status'      => 'returned',
            'returned_at' => date('Y-m-d H:i:s'),
        ]);
        $this->equipment->increaseQuantity((int) $loan->equipment_id, max(1, (int) $loan->quantity));

        $requestId = $loan->request_id !== null ? (int) $loan->request_id : 0;
        if ($requestId > 0 && $this->requests->isDelivered($requestId)) {
            $hasLoans = $this->loans->totalCountByRequestId($requestId) > 0;
            $activeLeft = $this->loans->activeCountByRequestId($requestId);
            if ($hasLoans && $activeLeft === 0) {
                $this->requests->setRequestStatus($requestId, 'returned');
                $this->audit->log($actorUserId, 'status', 'equipment_request', $requestId, ['status' => 'returned']);
            }
        }

        $this->audit->log($actorUserId, 'return', 'equipment_loan', $loanId);
    }
}
