<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCompetencyRequirementToVehiclesAndCreateWannabeCompetencies extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('vehicles') && ! $this->db->fieldExists('competency_requirement', 'vehicles')) {
            $this->forge->addColumn('vehicles', [
                'competency_requirement' => [
                    'type' => 'VARCHAR',
                    'constraint' => 10,
                    'default' => 'none',
                    'after' => 'registration_number',
                ],
            ]);
        }

        if (! $this->db->tableExists('wannabe_competencies')) {
            $this->forge->addField([
                'id' => ['type' => 'BIGINT', 'unsigned' => true, 'auto_increment' => true],
                'wannabe_id' => ['type' => 'BIGINT', 'unsigned' => true],
                't1' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                't2' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                't3' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                't4' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'b' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'be' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'c1' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'c1e' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'c' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'ce' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'kdo' => ['type' => 'TINYINT', 'constraint' => 1, 'default' => 0],
                'created_at' => ['type' => 'DATETIME'],
                'updated_at' => ['type' => 'DATETIME'],
            ]);
            $this->forge->addKey('id', true);
            $this->forge->addUniqueKey('wannabe_id');
            $this->forge->createTable('wannabe_competencies', true, [
                'ENGINE' => 'InnoDB',
                'DEFAULT CHARSET' => 'utf8mb4',
                'COLLATE' => 'utf8mb4_unicode_ci',
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('wannabe_competencies')) {
            $this->forge->dropTable('wannabe_competencies', true);
        }

        if ($this->db->tableExists('vehicles') && $this->db->fieldExists('competency_requirement', 'vehicles')) {
            $this->forge->dropColumn('vehicles', 'competency_requirement');
        }
    }
}
