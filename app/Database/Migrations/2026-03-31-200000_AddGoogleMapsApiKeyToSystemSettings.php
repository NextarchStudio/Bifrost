<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddGoogleMapsApiKeyToSystemSettings extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('system_settings') && ! $this->db->fieldExists('google_maps_api_key', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'google_maps_api_key' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'smtp_crypto',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('system_settings') && $this->db->fieldExists('google_maps_api_key', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'google_maps_api_key');
        }
    }
}
