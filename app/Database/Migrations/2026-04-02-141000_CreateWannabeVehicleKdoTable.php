<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateWannabeVehicleKdoTable extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('wannabe_vehicle_kdo')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'vehicle_id' => ['type' => 'BIGINT', 'unsigned' => true],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey(['wannabe_id', 'vehicle_id']);
            $this->forge->addKey('vehicle_id');
            $this->forge->createTable('wannabe_vehicle_kdo', true, [
                'ENGINE' => 'InnoDB',
                'DEFAULT CHARSET' => 'utf8mb4',
                'COLLATE' => 'utf8mb4_unicode_ci',
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('wannabe_vehicle_kdo')) {
            $this->forge->dropTable('wannabe_vehicle_kdo', true);
        }
    }
}
