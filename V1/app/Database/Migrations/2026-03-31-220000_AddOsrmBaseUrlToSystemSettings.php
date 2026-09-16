<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddOsrmBaseUrlToSystemSettings extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('system_settings') && ! $this->db->fieldExists('osrm_base_url', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'osrm_base_url' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'google_maps_api_key',
                ],
            ]);

            $this->db->table('system_settings')
                ->where('id', 1)
                ->update(['osrm_base_url' => 'http://localhost:5000']);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('system_settings') && $this->db->fieldExists('osrm_base_url', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'osrm_base_url');
        }
    }
}
