<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddOdometerModeToVehicles extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('vehicles')) {
            return;
        }

        if (! $this->db->fieldExists('odometer_exempt', 'vehicles')) {
            $this->forge->addColumn('vehicles', [
                'odometer_exempt' => [
                    'type' => 'TINYINT',
                    'constraint' => 1,
                    'default' => 0,
                    'after' => 'current_odometer',
                ],
            ]);
        }

        if ($this->db->fieldExists('current_odometer', 'vehicles')) {
            $this->db->query('ALTER TABLE `vehicles` MODIFY `current_odometer` INT UNSIGNED NULL');
        }
    }

    public function down(): void
    {
        if (! $this->db->tableExists('vehicles')) {
            return;
        }

        if ($this->db->fieldExists('current_odometer', 'vehicles')) {
            $this->db->query('UPDATE `vehicles` SET `current_odometer` = 0 WHERE `current_odometer` IS NULL');
            $this->db->query('ALTER TABLE `vehicles` MODIFY `current_odometer` INT UNSIGNED NOT NULL DEFAULT 0');
        }

        if ($this->db->fieldExists('odometer_exempt', 'vehicles')) {
            $this->forge->dropColumn('vehicles', 'odometer_exempt');
        }
    }
}
