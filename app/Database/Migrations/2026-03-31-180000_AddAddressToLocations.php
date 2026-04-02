<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAddressToLocations extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('locations') && ! $this->db->fieldExists('address', 'locations')) {
            $this->forge->addColumn('locations', [
                'address' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'type',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('locations') && $this->db->fieldExists('address', 'locations')) {
            $this->forge->dropColumn('locations', 'address');
        }
    }
}
