<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVehicleAndOdometerToTransportJobs extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('vehicles') && ! $this->db->fieldExists('current_odometer', 'vehicles')) {
            $this->forge->addColumn('vehicles', [
                'current_odometer' => [
                    'type' => 'INT',
                    'unsigned' => true,
                    'default' => 0,
                    'after' => 'registration_number',
                ],
            ]);
        }

        if ($this->db->tableExists('transport_jobs')) {
            $fields = [];

            if (! $this->db->fieldExists('assigned_vehicle_id', 'transport_jobs')) {
                $fields['assigned_vehicle_id'] = [
                    'type' => 'BIGINT',
                    'unsigned' => true,
                    'null' => true,
                    'after' => 'assigned_user_id',
                ];
            }
            if (! $this->db->fieldExists('start_odometer', 'transport_jobs')) {
                $fields['start_odometer'] = [
                    'type' => 'INT',
                    'unsigned' => true,
                    'null' => true,
                    'after' => 'assigned_vehicle_id',
                ];
            }
            if (! $this->db->fieldExists('end_odometer', 'transport_jobs')) {
                $fields['end_odometer'] = [
                    'type' => 'INT',
                    'unsigned' => true,
                    'null' => true,
                    'after' => 'start_odometer',
                ];
            }
            if (! $this->db->fieldExists('distance_km', 'transport_jobs')) {
                $fields['distance_km'] = [
                    'type' => 'INT',
                    'unsigned' => true,
                    'null' => true,
                    'after' => 'end_odometer',
                ];
            }

            if ($fields !== []) {
                $this->forge->addColumn('transport_jobs', $fields);
            }

            if ($this->db->fieldExists('assigned_vehicle_id', 'transport_jobs')) {
                $this->forge->addKey('assigned_vehicle_id');
                $this->forge->processIndexes('transport_jobs');
                $this->db->query('ALTER TABLE `transport_jobs` ADD CONSTRAINT `transport_jobs_assigned_vehicle_id_foreign` FOREIGN KEY (`assigned_vehicle_id`) REFERENCES `vehicles` (`id`) ON DELETE SET NULL ON UPDATE SET NULL');
            }
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('transport_jobs') && $this->db->fieldExists('assigned_vehicle_id', 'transport_jobs')) {
            $this->db->query('ALTER TABLE `transport_jobs` DROP FOREIGN KEY `transport_jobs_assigned_vehicle_id_foreign`');
            $this->forge->dropColumn('transport_jobs', ['assigned_vehicle_id', 'start_odometer', 'end_odometer', 'distance_km']);
        }

        if ($this->db->tableExists('vehicles') && $this->db->fieldExists('current_odometer', 'vehicles')) {
            $this->forge->dropColumn('vehicles', 'current_odometer');
        }
    }
}
