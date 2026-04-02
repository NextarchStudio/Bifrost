<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVegvesenExemptToVehicles extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('vehicles') && ! $this->db->fieldExists('vegvesen_exempt', 'vehicles')) {
            $this->forge->addColumn('vehicles', [
                'vegvesen_exempt' => [
                    'type' => 'TINYINT',
                    'constraint' => 1,
                    'default' => 0,
                    'after' => 'odometer_exempt',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('vehicles') && $this->db->fieldExists('vegvesen_exempt', 'vehicles')) {
            $this->forge->dropColumn('vehicles', 'vegvesen_exempt');
        }
    }
}
