<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddWannabeRoleNameToRoles extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('roles')) {
            return;
        }

        if (! $this->db->fieldExists('wannabe_role_name', 'roles')) {
            $this->forge->addColumn('roles', [
                'wannabe_role_name' => [
                    'type' => 'VARCHAR',
                    'constraint' => 150,
                    'null' => true,
                    'after' => 'name',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('roles') && $this->db->fieldExists('wannabe_role_name', 'roles')) {
            $this->forge->dropColumn('roles', 'wannabe_role_name');
        }
    }
}
