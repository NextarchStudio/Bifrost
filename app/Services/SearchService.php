<?php
declare(strict_types=1);

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

class SearchService
{
    private BaseConnection $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    public function search(string $term): array
    {
        $term = mb_substr(strip_tags(trim($term)), 0, 100);
        if ($term === '') {
            return [];
        }

        $like = '%' . $this->db->escapeLikeString($term) . '%';
        $sql = 'SELECT e.id, e.name, e.serial_number, l.name AS location_name, p.name AS pallet_name, ps.slot_number
                FROM equipment e
                LEFT JOIN pallet_slots ps ON ps.id = e.pallet_slot_id
                LEFT JOIN pallets p ON p.id = ps.pallet_id
                LEFT JOIN locations l ON l.id = p.location_id
                WHERE e.name LIKE ? ESCAPE "!"
                   OR e.serial_number LIKE ? ESCAPE "!"
                   OR l.name LIKE ? ESCAPE "!"
                   OR p.name LIKE ? ESCAPE "!"
                   OR CAST(ps.slot_number AS CHAR) LIKE ? ESCAPE "!"
                ORDER BY e.name ASC
                LIMIT 25';
        $equipment = $this->db->query($sql, [$like, $like, $like, $like, $like])->getResultArray();

        $loans = $this->db->query(
            'SELECT id, equipment_id, wannabe_id, status, issued_at
             FROM equipment_loans
             WHERE CAST(wannabe_id AS CHAR) LIKE ? ESCAPE "!"
             ORDER BY issued_at DESC
             LIMIT 25',
            [$like]
        )->getResultArray();

        return [
            'equipment' => $equipment,
            'loans'     => $loans,
        ];
    }
}

