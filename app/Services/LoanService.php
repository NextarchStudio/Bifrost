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
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function active(?string $search = null): array
    {
        $loans = $this->loans->activeLoans($search);

        return $this->enrichLoanNames($loans);
    }

    public function loanableEquipment(): array
    {
        return array_values(array_filter(
            $this->equipment->allWithContext(),
            static fn (object $item): bool => (int) ($item->quantity ?? 0) > 0 && (string) ($item->status ?? '') !== 'maintenance'
        ));
    }

    public function issue(array $input, int $actorUserId): int
    {
        $wannabeId = (int) ($input['wannabe_id'] ?? 0);
        if ($wannabeId < 1) {
            throw new \InvalidArgumentException('Ugyldig wannabe ID.');
        }

        $barcodes = $input['barcodes'] ?? $input['barcode'] ?? [];
        $quantities = $input['quantities'] ?? $input['quantity'] ?? [];

        if (! is_array($barcodes)) {
            $barcodes = [$barcodes];
        }

        if (! is_array($quantities)) {
            $quantities = [$quantities];
        }

        $loanLines = [];
        foreach ($barcodes as $index => $barcodeValue) {
            $barcode = trim((string) $barcodeValue);
            if ($barcode === '') {
                continue;
            }

            $wantedQuantity = max(1, (int) ($quantities[$index] ?? 1));
            $loanLines[] = [
                'barcode' => $barcode,
                'quantity' => $wantedQuantity,
            ];
        }

        if ($loanLines === []) {
            throw new \InvalidArgumentException('Legg inn minst ett strekkodenummer.');
        }

        $lastLoanId = 0;

        foreach ($loanLines as $loanLine) {
            $barcode = $loanLine['barcode'];
            $wantedQuantity = $loanLine['quantity'];

            $equipment = $this->equipment->findBySerialNumber($barcode);
            if ($equipment === null) {
                throw new \InvalidArgumentException('Ugyldig strekkode/serienummer: ' . $barcode . '.');
            }

            $equipmentId = (int) $equipment->id;
            if (! $this->equipment->isAvailable($equipmentId)) {
                throw new \InvalidArgumentException('Utstyret med strekkode ' . $barcode . ' er ikke tilgjengelig på lager.');
            }

            $availableQuantity = $this->equipment->quantity($equipmentId);
            if ($wantedQuantity > $availableQuantity) {
                throw new \InvalidArgumentException('Det finnes ikke nok antall tilgjengelig på lager for strekkode ' . $barcode . '.');
            }

            $existingLoan = $this->loans->findActiveByEquipmentAndWannabe($equipmentId, $wannabeId);
            if ($existingLoan !== null) {
                $lastLoanId = (int) $existingLoan->id;
                $this->loans->updateById($lastLoanId, [
                    'quantity' => max(1, (int) $existingLoan->quantity) + $wantedQuantity,
                ]);
            } else {
                $lastLoanId = $this->loans->create([
                    'equipment_id' => $equipmentId,
                    'wannabe_id' => $wannabeId,
                    'quantity' => $wantedQuantity,
                    'issued_by_user_id' => $actorUserId,
                    'issued_at' => date('Y-m-d H:i:s'),
                    'returned_at' => null,
                    'status' => 'active',
                ]);
            }

            $this->equipment->reduceQuantity($equipmentId, $wantedQuantity);
            $this->audit->log($actorUserId, 'issue', 'equipment_loan', $lastLoanId, [
                'barcode' => $barcode,
                'wannabe_id' => $wannabeId,
                'quantity' => $wantedQuantity,
            ]);
        }

        return $lastLoanId;
    }

    /**
     * @return array{loanId:int, returnedQuantity:int, remainingQuantity:int, status:string}
     */
    public function returnLoan(int $loanId, array $input, int $actorUserId): array
    {
        $loan = $this->loans->findById($loanId);
        if ($loan === null) {
            throw new \InvalidArgumentException('Lån ikke funnet.');
        }

        $returnQuantity = max(1, (int) ($input['quantity'] ?? 1));
        $loanQuantity = max(1, (int) $loan->quantity);
        if ($returnQuantity > $loanQuantity) {
            throw new \InvalidArgumentException('Du kan ikke returnere flere enn det som er lånt ut.');
        }

        $this->equipment->increaseQuantity((int) $loan->equipment_id, $returnQuantity);

        if ($returnQuantity >= $loanQuantity) {
            $this->loans->updateById($loanId, [
                'quantity' => 0,
                'status' => 'returned',
                'returned_at' => date('Y-m-d H:i:s'),
            ]);
        } else {
            $this->loans->updateById($loanId, [
                'quantity' => $loanQuantity - $returnQuantity,
            ]);
        }

        $requestId = $loan->request_id !== null ? (int) $loan->request_id : 0;
        if ($requestId > 0 && $this->requests->isDelivered($requestId)) {
            $hasLoans = $this->loans->totalCountByRequestId($requestId) > 0;
            $activeLeft = $this->loans->activeCountByRequestId($requestId);
            if ($hasLoans && $activeLeft === 0) {
                $this->requests->setRequestStatus($requestId, 'returned');
                $this->audit->log($actorUserId, 'status', 'equipment_request', $requestId, ['status' => 'returned']);
            }
        }

        $this->audit->log($actorUserId, 'return', 'equipment_loan', $loanId, [
            'returned_quantity' => $returnQuantity,
            'remaining_quantity' => max(0, $loanQuantity - $returnQuantity),
        ]);

        return [
            'loanId' => $loanId,
            'returnedQuantity' => $returnQuantity,
            'remainingQuantity' => max(0, $loanQuantity - $returnQuantity),
            'status' => $returnQuantity >= $loanQuantity ? 'returned' : 'active',
        ];
    }

    private function enrichLoanNames(array $loans): array
    {
        if ($loans === [] || ! $this->crewDirectory->isConfigured()) {
            return $loans;
        }

        $cache = [];

        foreach ($loans as $loan) {
            $existingName = trim((string) (($loan->wannabe_name ?? '') !== '' ? $loan->wannabe_name : (($loan->wannabe_first_name ?? '') . ' ' . ($loan->wannabe_last_name ?? ''))));
            $wannabeId = (int) ($loan->wannabe_id ?? 0);
            if ($existingName !== '' || $wannabeId < 1) {
                continue;
            }

            if (! array_key_exists($wannabeId, $cache)) {
                $profile = $this->crewDirectory->profileByWannabeId($wannabeId);
                $cache[$wannabeId] = is_array($profile) ? trim((string) ($profile['name'] ?? '')) : '';
            }

            if ($cache[$wannabeId] !== '') {
                $loan->wannabe_name = $cache[$wannabeId];
            }
        }

        return $loans;
    }
}
