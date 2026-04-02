<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCompetencyOverrideToVehicles extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('vehicles') && ! $this->db->fieldExists('competency_override_requirement', 'vehicles')) {
            $this->forge->addColumn('vehicles', [
                'competency_override_requirement' => [
                    'type' => 'VARCHAR',
                    'constraint' => 10,
                    'null' => true,
                    'after' => 'competency_requirement',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('vehicles') && $this->db->fieldExists('competency_override_requirement', 'vehicles')) {
            $this->forge->dropColumn('vehicles', 'competency_override_requirement');
        }
    }
}
