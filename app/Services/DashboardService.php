<?php
declare(strict_types=1);

namespace App\Services;

use CodeIgniter\Database\BaseConnection;
use Config\Database;

class DashboardService
{
    private const TRANSPORT_ARCHIVE_LOCATION = 'Slettet lokasjon (transportarkiv)';

    private BaseConnection $db;

    public function __construct()
    {
        $this->db = Database::connect();
    }

    public function summary(): array
    {
        $activeEquipmentItems = (int) ($this->db->table('equipment_loans')
            ->select('COALESCE(SUM(quantity), 0) AS total')
            ->where('status', 'active')
            ->get()
            ->getRowArray()['total'] ?? 0);
        $activeCommsItems = 0;
        if ($this->db->tableExists('comms_loans') && $this->db->tableExists('comms_loan_items')) {
            $activeCommsItems = (int) ($this->db->table('comms_loan_items cli')
                ->select('COALESCE(SUM(cli.quantity), 0) AS total')
                ->join('comms_loans cl', 'cl.id = cli.loan_id', 'inner')
                ->where('cl.status', 'active')
                ->get()
                ->getRowArray()['total'] ?? 0);
        }
        $activeLoans = $activeEquipmentItems + $activeCommsItems;
        $activeVehicleLoans = $this->db->tableExists('vehicle_loans')
            ? (int) $this->db->table('vehicle_loans')->where('status', 'active')->countAllResults()
            : 0;
        $totalTransportDistance = $this->db->tableExists('transport_jobs')
            ? (int) ($this->db->table('transport_jobs')
                ->select('COALESCE(SUM(distance_km), 0) AS total')
                ->where('distance_km IS NOT NULL', null, false)
                ->get()
                ->getRowArray()['total'] ?? 0)
            : 0;
        $activeTransport = (int) $this->db->table('transport_jobs')->whereIn('status', ['open', 'assigned', 'in_progress'])->countAllResults();
        $equipmentPerLocation = $this->db->query(
            'SELECT l.name AS location_name, COUNT(e.id) AS equipment_count
             FROM locations l
             LEFT JOIN pallets p ON p.location_id = l.id
             LEFT JOIN pallet_slots ps ON ps.pallet_id = p.id
             LEFT JOIN equipment e ON e.pallet_slot_id = ps.id
             WHERE LOWER(COALESCE(l.type, "")) <> "transport"
               AND l.name <> ?
             GROUP BY l.id, l.name
             ORDER BY l.name ASC'
        , [self::TRANSPORT_ARCHIVE_LOCATION])->getResultArray();

        return [
            'activeLoans'          => $activeLoans,
            'activeVehicleLoans'   => $activeVehicleLoans,
            'totalTransportDistance' => $totalTransportDistance,
            'activeTransportJobs'  => $activeTransport,
            'equipmentPerLocation' => $equipmentPerLocation,
        ];
    }
}
