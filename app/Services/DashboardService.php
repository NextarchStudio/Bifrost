<?php
declare(strict_types=1);

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

class DashboardService
{
    private BaseConnection $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    public function summary(): array
    {
        $activeLoans = (int) $this->db->table('equipment_loans')->where('status', 'active')->countAllResults();
        $activeTransport = (int) $this->db->table('transport_jobs')->whereIn('status', ['open', 'assigned', 'in_progress'])->countAllResults();
        $equipmentPerLocation = $this->db->query(
            'SELECT l.name AS location_name, COUNT(e.id) AS equipment_count
             FROM locations l
             LEFT JOIN pallets p ON p.location_id = l.id
             LEFT JOIN pallet_slots ps ON ps.pallet_id = p.id
             LEFT JOIN equipment e ON e.pallet_slot_id = ps.id
             GROUP BY l.id, l.name
             ORDER BY l.name ASC'
        )->getResultArray();

        return [
            'activeLoans'          => $activeLoans,
            'activeTransportJobs'  => $activeTransport,
            'equipmentPerLocation' => $equipmentPerLocation,
        ];
    }
}

