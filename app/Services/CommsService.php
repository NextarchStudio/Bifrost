<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\CommsRepository;

class CommsService
{
    public function __construct(
        private readonly CommsRepository $comms = new CommsRepository(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly AuditService $audit = new AuditService()
    ) {
    }

    public function pageData(): array
    {
        $sets = $this->comms->allSetsWithSummary();
        foreach ($sets as &$set) {
            $set['items'] = $this->comms->setItems((int) $set['id']);
            $set['active_loans'] = $this->comms->activeLoanCountBySetId((int) $set['id']);
        }
        unset($set);

        $activeLoans = $this->comms->activeLoansWithSummary();
        foreach ($activeLoans as &$loan) {
            $loan['loan_items'] = $this->comms->loanItems((int) $loan['id']);
        }
        unset($loan);

        $activeLoans = $this->enrichLoanNames($activeLoans);

        return [
            'items' => $this->comms->allItems(),
            'sets' => $sets,
            'activeLoans' => $activeLoans,
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

    public function updateSet(int $setId, array $input, int $actorUserId): void
    {
        $set = $this->comms->findSetById($setId);
        if ($set === null) {
            throw new \InvalidArgumentException('Sambandssett finnes ikke.');
        }

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

        $this->comms->updateSetById($setId, [
            'name' => $name,
            'notes' => ! empty($input['notes']) ? mb_substr(strip_tags((string) $input['notes']), 0, 2000) : null,
            'updated_at' => date('Y-m-d H:i:s'),
        ]);

        $this->comms->deleteSetItemsBySetId($setId);
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

        $this->audit->log($actorUserId, 'update', 'comms_set', $setId, ['name' => $name]);
    }

    public function deleteSet(int $setId, int $actorUserId): void
    {
        $set = $this->comms->findSetById($setId);
        if ($set === null) {
            throw new \InvalidArgumentException('Sambandssett finnes ikke.');
        }

        if ($this->comms->activeLoanCountBySetId($setId) > 0) {
            throw new \InvalidArgumentException('Sambandssett kan ikke slettes mens det er utlånt.');
        }

        $this->comms->deleteSetById($setId);
        $this->audit->log($actorUserId, 'delete', 'comms_set', $setId, ['name' => (string) ($set['name'] ?? '')]);
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

    public function returnLoan(int $loanId, array $input, int $actorUserId): void
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
        $loanItemsByItemId = [];
        foreach ($loanItems as $loanItem) {
            $loanItemsByItemId[(int) $loanItem['item_id']] = $loanItem;
        }

        $returns = (array) ($input['return_quantities'] ?? []);
        $didChange = false;

        foreach ($returns as $itemId => $quantity) {
            $itemId = (int) $itemId;
            $returnQty = max(0, (int) $quantity);
            if ($returnQty < 1 || ! isset($loanItemsByItemId[$itemId])) {
                continue;
            }

            $loanItem = $loanItemsByItemId[$itemId];
            $loanQty = max(1, (int) $loanItem['quantity']);
            if ($returnQty > $loanQty) {
                throw new \InvalidArgumentException('Du kan ikke returnere flere enn det som er utlånt for ' . (string) ($loanItem['item_name'] ?? 'valgt linje') . '.');
            }

            $item = $this->comms->findItemById($itemId);
            if ($item !== null) {
                $newQty = max(0, (int) $item['quantity']) + $returnQty;
                $this->comms->updateItemById($itemId, [
                    'quantity' => $newQty,
                    'status' => 'available',
                    'updated_at' => $now,
                ]);
            }

            $remaining = $loanQty - $returnQty;
            if ($remaining > 0) {
                $this->comms->updateLoanItemQuantity($loanId, $itemId, $remaining);
            } else {
                $this->comms->deleteLoanItem($loanId, $itemId);
            }

            $didChange = true;
        }

        $replacementItemId = (int) ($input['replacement_item_id'] ?? 0);
        $replacementQuantity = max(0, (int) ($input['replacement_quantity'] ?? 0));
        if ($replacementItemId > 0 && $replacementQuantity > 0) {
            $replacement = $this->comms->findItemById($replacementItemId);
            if ($replacement === null) {
                throw new \InvalidArgumentException('Valgt erstatningsutstyr finnes ikke.');
            }
            if ((int) $replacement['quantity'] < $replacementQuantity) {
                throw new \InvalidArgumentException('Ikke nok antall tilgjengelig for valgt erstatningsutstyr.');
            }

            $existingLoanItem = $loanItemsByItemId[$replacementItemId] ?? null;
            if ($existingLoanItem !== null) {
                $this->comms->updateLoanItemQuantity(
                    $loanId,
                    $replacementItemId,
                    max(1, (int) $existingLoanItem['quantity']) + $replacementQuantity
                );
            } else {
                $this->comms->addLoanItem([
                    'loan_id' => $loanId,
                    'item_id' => $replacementItemId,
                    'quantity' => $replacementQuantity,
                ]);
            }

            $newReplacementQty = max(0, (int) $replacement['quantity'] - $replacementQuantity);
            $this->comms->updateItemById($replacementItemId, [
                'quantity' => $newReplacementQty,
                'status' => $newReplacementQty > 0 ? 'available' : 'loaned',
                'updated_at' => $now,
            ]);

            $didChange = true;
        }

        if (! $didChange) {
            throw new \InvalidArgumentException('Velg minst en delretur eller et bytte.');
        }

        $remainingLoanItems = $this->comms->loanItems($loanId);
        if ($remainingLoanItems === []) {
            $this->comms->updateLoanById($loanId, [
                'status' => 'returned',
                'returned_at' => $now,
            ]);
        } else {
            $this->comms->updateLoanById($loanId, [
                'status' => 'active',
                'returned_at' => null,
            ]);
        }

        $this->audit->log($actorUserId, 'return', 'comms_loan', $loanId, [
            'returns' => $returns,
            'replacement_item_id' => $replacementItemId > 0 ? $replacementItemId : null,
            'replacement_quantity' => $replacementQuantity > 0 ? $replacementQuantity : null,
        ]);
    }

    private function enrichLoanNames(array $loans): array
    {
        if ($loans === [] || ! $this->crewDirectory->isConfigured()) {
            return $loans;
        }

        $cache = [];

        foreach ($loans as &$loan) {
            $existingName = trim((string) (($loan['wannabe_name'] ?? '') !== '' ? $loan['wannabe_name'] : (($loan['wannabe_first_name'] ?? '') . ' ' . ($loan['wannabe_last_name'] ?? ''))));
            $wannabeId = (int) ($loan['wannabe_id'] ?? 0);
            if ($existingName !== '' || $wannabeId < 1) {
                continue;
            }

            if (! array_key_exists($wannabeId, $cache)) {
                $profile = $this->crewDirectory->profileByWannabeId($wannabeId);
                $cache[$wannabeId] = is_array($profile) ? trim((string) ($profile['name'] ?? '')) : '';
            }

            if ($cache[$wannabeId] !== '') {
                $loan['wannabe_name'] = $cache[$wannabeId];
            }
        }
        unset($loan);

        return $loans;
    }
}
