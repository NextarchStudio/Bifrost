<?php
declare(strict_types=1);

namespace App\Repositories;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

class CommsRepository
{
    private BaseConnection $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    public function allItems(): array
    {
        return $this->db->table('comms_items')
            ->orderBy('name', 'ASC')
            ->get()
            ->getResultArray();
    }

    public function createItem(array $data): int
    {
        $this->db->table('comms_items')->insert($data);

        return (int) $this->db->insertID();
    }

    public function findItemById(int $itemId): ?array
    {
        $row = $this->db->table('comms_items')
            ->where('id', $itemId)
            ->get()
            ->getRowArray();

        return $row !== null ? $row : null;
    }

    public function updateItemById(int $itemId, array $data): bool
    {
        return (bool) $this->db->table('comms_items')->where('id', $itemId)->update($data);
    }

    public function allSetsWithSummary(): array
    {
        return $this->db->table('comms_sets cs')
            ->select("cs.*, GROUP_CONCAT(CONCAT(ci.name, ' x', csi.quantity) ORDER BY ci.name SEPARATOR ', ') AS items_summary")
            ->join('comms_set_items csi', 'csi.set_id = cs.id', 'left')
            ->join('comms_items ci', 'ci.id = csi.item_id', 'left')
            ->groupBy('cs.id')
            ->orderBy('cs.name', 'ASC')
            ->get()
            ->getResultArray();
    }

    public function createSet(array $data): int
    {
        $this->db->table('comms_sets')->insert($data);

        return (int) $this->db->insertID();
    }

    public function findSetById(int $setId): ?array
    {
        $row = $this->db->table('comms_sets')
            ->where('id', $setId)
            ->get()
            ->getRowArray();

        return $row !== null ? $row : null;
    }

    public function updateSetById(int $setId, array $data): bool
    {
        return (bool) $this->db->table('comms_sets')->where('id', $setId)->update($data);
    }

    public function deleteSetById(int $setId): bool
    {
        return (bool) $this->db->table('comms_sets')->where('id', $setId)->delete();
    }

    public function addSetItem(array $data): void
    {
        $this->db->table('comms_set_items')->insert($data);
    }

    public function deleteSetItemsBySetId(int $setId): bool
    {
        return (bool) $this->db->table('comms_set_items')->where('set_id', $setId)->delete();
    }

    public function setItems(int $setId): array
    {
        return $this->db->table('comms_set_items csi')
            ->select('csi.*, ci.name AS item_name, ci.quantity AS item_quantity, ci.status AS item_status')
            ->join('comms_items ci', 'ci.id = csi.item_id', 'inner')
            ->where('csi.set_id', $setId)
            ->orderBy('csi.id', 'ASC')
            ->get()
            ->getResultArray();
    }

    public function createLoan(array $data): int
    {
        $this->db->table('comms_loans')->insert($data);

        return (int) $this->db->insertID();
    }

    public function addLoanItem(array $data): void
    {
        $this->db->table('comms_loan_items')->insert($data);
    }

    public function updateLoanItemQuantity(int $loanId, int $itemId, int $quantity): bool
    {
        return (bool) $this->db->table('comms_loan_items')
            ->where('loan_id', $loanId)
            ->where('item_id', $itemId)
            ->update(['quantity' => $quantity]);
    }

    public function deleteLoanItem(int $loanId, int $itemId): bool
    {
        return (bool) $this->db->table('comms_loan_items')
            ->where('loan_id', $loanId)
            ->where('item_id', $itemId)
            ->delete();
    }

    public function loanItems(int $loanId): array
    {
        return $this->db->table('comms_loan_items cli')
            ->select('cli.*, ci.name AS item_name, ci.type AS item_type, ci.serial_number')
            ->join('comms_items ci', 'ci.id = cli.item_id', 'inner')
            ->where('cli.loan_id', $loanId)
            ->orderBy('cli.id', 'ASC')
            ->get()
            ->getResultArray();
    }

    public function activeLoansWithSummary(): array
    {
        return $this->db->table('comms_loans cl')
            ->select("cl.*, cs.name AS set_name, u.name AS wannabe_name, u.first_name AS wannabe_first_name, u.last_name AS wannabe_last_name, GROUP_CONCAT(CONCAT(ci.name, ' x', cli.quantity) ORDER BY ci.name SEPARATOR ', ') AS items_summary, COALESCE(SUM(cli.quantity), 0) AS total_items")
            ->join('comms_sets cs', 'cs.id = cl.set_id', 'left')
            ->join('users u', 'u.wannabe_id = cl.wannabe_id', 'left')
            ->join('comms_loan_items cli', 'cli.loan_id = cl.id', 'left')
            ->join('comms_items ci', 'ci.id = cli.item_id', 'left')
            ->where('cl.status', 'active')
            ->groupBy('cl.id')
            ->orderBy('cl.issued_at', 'DESC')
            ->get()
            ->getResultArray();
    }

    public function findLoanById(int $loanId): ?array
    {
        $row = $this->db->table('comms_loans')
            ->where('id', $loanId)
            ->get()
            ->getRowArray();

        return $row !== null ? $row : null;
    }

    public function updateLoanById(int $loanId, array $data): bool
    {
        return (bool) $this->db->table('comms_loans')->where('id', $loanId)->update($data);
    }

    public function activeLoansByWannabeId(int $wannabeId): array
    {
        return $this->db->table('comms_loans cl')
            ->select("cl.*, cs.name AS set_name, GROUP_CONCAT(CONCAT(ci.name, ' x', cli.quantity) ORDER BY ci.name SEPARATOR ', ') AS items_summary, COALESCE(SUM(cli.quantity), 0) AS total_items")
            ->join('comms_sets cs', 'cs.id = cl.set_id', 'left')
            ->join('comms_loan_items cli', 'cli.loan_id = cl.id', 'left')
            ->join('comms_items ci', 'ci.id = cli.item_id', 'left')
            ->where('cl.wannabe_id', $wannabeId)
            ->where('cl.status', 'active')
            ->groupBy('cl.id')
            ->orderBy('cl.issued_at', 'DESC')
            ->get()
            ->getResultArray();
    }

    public function activeLoanCountBySetId(int $setId): int
    {
        return (int) $this->db->table('comms_loans')
            ->where('set_id', $setId)
            ->where('status', 'active')
            ->countAllResults();
    }

    public function activeLoanedItemCount(): int
    {
        $row = $this->db->table('comms_loan_items cli')
            ->select('COALESCE(SUM(cli.quantity), 0) AS total')
            ->join('comms_loans cl', 'cl.id = cli.loan_id', 'inner')
            ->where('cl.status', 'active')
            ->get()
            ->getRowArray();

        return (int) ($row['total'] ?? 0);
    }
}
