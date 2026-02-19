<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\CommsRepository;

class CommsService
{
    public function __construct(
        private readonly CommsRepository $comms = new CommsRepository(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function pageData(): array
    {
        return [
            'items' => $this->comms->allItems(),
            'sets' => $this->comms->allSetsWithSummary(),
            'activeLoans' => $this->comms->activeLoansWithSummary(),
        ];
    }

    public function createItem(array $input, int $actorUserId): int
    {
        $rules = [
            'name' => 'required|min_length[2]|max_length[140]',
            'type' => 'required|in_list[samband,tilbehor]',
            'serial_number' => 'permit_empty|max_length[150]',
            'quantity' => 'required|integer|greater_than_equal_to[1]|less_than_equal_to[1000]',
            'notes' => 'permit_empty|max_length[2000]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException(implode(' ', service('validation')->getErrors()));
        }

        $id = $this->comms->createItem([
            'name' => mb_substr(strip_tags((string) $input['name']), 0, 140),
            'type' => (string) $input['type'],
            'serial_number' => ! empty($input['serial_number']) ? mb_substr(strip_tags((string) $input['serial_number']), 0, 150) : null,
            'quantity' => (int) $input['quantity'],
            'status' => 'available',
            'notes' => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 2000) : null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->audit->log($actorUserId, 'create', 'comms_item', $id, ['name' => (string) $input['name']]);

        return $id;
    }

    public function createSet(array $input, int $actorUserId): int
    {
        $name = mb_substr(trim(strip_tags((string) ($input['name'] ?? ''))), 0, 120);
        if ($name === '') {
            throw new \InvalidArgumentException('Navn på sambandssett er påkrevd.');
        }

        $items = [];
        foreach ((array) ($input['items'] ?? []) as $itemId => $payload) {
            if (! isset($payload['selected'])) {
                continue;
            }
            $qty = max(1, (int) ($payload['quantity'] ?? 1));
            $items[] = ['item_id' => (int) $itemId, 'quantity' => $qty];
        }
        if ($items === []) {
            throw new \InvalidArgumentException('Velg minst ett samband/tilbehør i settet.');
        }

        $setId = $this->comms->createSet([
            'name' => $name,
            'notes' => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 2000) : null,
            'created_at' => date('Y-m-d H:i:s'),
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        foreach ($items as $item) {
            $row = $this->comms->findItemById($item['item_id']);
            if ($row === null) {
                continue;
            }
            $this->comms->addSetItem([
                'set_id' => $setId,
                'item_id' => $item['item_id'],
                'quantity' => $item['quantity'],
            ]);
        }

        $this->audit->log($actorUserId, 'create', 'comms_set', $setId, ['name' => $name]);

        return $setId;
    }

    public function issue(array $input, int $actorUserId): int
    {
        $rules = [
            'wannabe_id' => 'required|integer|greater_than[0]',
            'loan_type' => 'required|in_list[item,set]',
            'item_id' => 'permit_empty|integer',
            'set_id' => 'permit_empty|integer',
            'quantity' => 'permit_empty|integer|greater_than[0]|less_than_equal_to[100]',
            'notes' => 'permit_empty|max_length[2000]',
        ];
        if (! service('validation')->setRules($rules)->run($input)) {
            throw new \InvalidArgumentException('Ugyldig samband-lån.');
        }

        $loanType = (string) $input['loan_type'];
        $wannabeId = (int) $input['wannabe_id'];
        $now = date('Y-m-d H:i:s');

        if ($loanType === 'item') {
            $itemId = (int) ($input['item_id'] ?? 0);
            $qty = max(1, (int) ($input['quantity'] ?? 1));
            $item = $this->comms->findItemById($itemId);
            if ($item === null) {
                throw new \InvalidArgumentException('Valgt samband/tilbehør finnes ikke.');
            }
            if ((int) $item['quantity'] < $qty) {
                throw new \InvalidArgumentException('Ikke nok antall tilgjengelig for valgt samband/tilbehør.');
            }

            $loanId = $this->comms->createLoan([
                'wannabe_id' => $wannabeId,
                'issued_by_user_id' => $actorUserId,
                'set_id' => null,
                'issued_at' => $now,
                'returned_at' => null,
                'status' => 'active',
                'notes' => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 2000) : null,
            ]);
            $this->comms->addLoanItem([
                'loan_id' => $loanId,
                'item_id' => $itemId,
                'quantity' => $qty,
            ]);
            $this->comms->updateItemById($itemId, [
                'quantity' => max(0, (int) $item['quantity'] - $qty),
                'status' => ((int) $item['quantity'] - $qty) > 0 ? 'available' : 'loaned',
                'updated_at' => $now,
            ]);

            $this->audit->log($actorUserId, 'issue', 'comms_loan', $loanId, ['loan_type' => 'item', 'item_id' => $itemId, 'quantity' => $qty]);

            return $loanId;
        }

        $setId = (int) ($input['set_id'] ?? 0);
        $setItems = $this->comms->setItems($setId);
        if ($setItems === []) {
            throw new \InvalidArgumentException('Valgt sambandssett har ingen linjer.');
        }

        foreach ($setItems as $setItem) {
            if ((int) $setItem['item_quantity'] < (int) $setItem['quantity']) {
                throw new \InvalidArgumentException('Ikke nok antall tilgjengelig for sett: ' . (string) $setItem['item_name']);
            }
        }

        $loanId = $this->comms->createLoan([
            'wannabe_id' => $wannabeId,
            'issued_by_user_id' => $actorUserId,
            'set_id' => $setId,
            'issued_at' => $now,
            'returned_at' => null,
            'status' => 'active',
            'notes' => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 2000) : null,
        ]);

        foreach ($setItems as $setItem) {
            $itemId = (int) $setItem['item_id'];
            $qty = (int) $setItem['quantity'];
            $currentQty = (int) $setItem['item_quantity'];
            $newQty = max(0, $currentQty - $qty);
            $this->comms->addLoanItem([
                'loan_id' => $loanId,
                'item_id' => $itemId,
                'quantity' => $qty,
            ]);
            $this->comms->updateItemById($itemId, [
                'quantity' => $newQty,
                'status' => $newQty > 0 ? 'available' : 'loaned',
                'updated_at' => $now,
            ]);
        }

        $this->audit->log($actorUserId, 'issue', 'comms_loan', $loanId, ['loan_type' => 'set', 'set_id' => $setId]);

        return $loanId;
    }

    public function returnLoan(int $loanId, int $actorUserId): void
    {
        $loan = $this->comms->findLoanById($loanId);
        if ($loan === null) {
            throw new \InvalidArgumentException('Samband-lån finnes ikke.');
        }
        if ((string) $loan['status'] !== 'active') {
            throw new \InvalidArgumentException('Samband-lånet er allerede returnert.');
        }

        $now = date('Y-m-d H:i:s');
        $loanItems = $this->comms->loanItems($loanId);
        foreach ($loanItems as $loanItem) {
            $itemId = (int) $loanItem['item_id'];
            $qty = max(1, (int) $loanItem['quantity']);
            $item = $this->comms->findItemById($itemId);
            if ($item === null) {
                continue;
            }
            $newQty = max(0, (int) $item['quantity']) + $qty;
            $this->comms->updateItemById($itemId, [
                'quantity' => $newQty,
                'status' => 'available',
                'updated_at' => $now,
            ]);
        }

        $this->comms->updateLoanById($loanId, [
            'status' => 'returned',
            'returned_at' => $now,
        ]);

        $this->audit->log($actorUserId, 'return', 'comms_loan', $loanId);
    }
}
