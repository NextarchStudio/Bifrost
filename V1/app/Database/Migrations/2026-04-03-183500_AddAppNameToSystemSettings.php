<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAppNameToSystemSettings extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('system_settings')) {
            return;
        }

        if (! $this->db->fieldExists('app_name', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'app_name' => [
                    'type' => 'VARCHAR',
                    'constraint' => 180,
                    'null' => true,
                    'after' => 'id',
                ],
            ]);
        }

        $this->db->table('system_settings')
            ->where('id', 1)
            ->set('app_name', 'Bifrost')
            ->update();
    }

    public function down(): void
    {
        if ($this->db->tableExists('system_settings') && $this->db->fieldExists('app_name', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'app_name');
        }
    }
}
