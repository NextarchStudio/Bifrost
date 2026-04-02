<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddVegvesenApiKeyAndPayloadCache extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('system_settings') && ! $this->db->fieldExists('vegvesen_api_key', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'vegvesen_api_key' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'logo_url',
                ],
            ]);
        }

        if ($this->db->tableExists('vehicles') && ! $this->db->fieldExists('max_payload_kg', 'vehicles')) {
            $this->forge->addColumn('vehicles', [
                'max_payload_kg' => [
                    'type' => 'INT',
                    'constraint' => 11,
                    'unsigned' => true,
                    'null' => true,
                    'after' => 'vegvesen_exempt',
                ],
                'vegvesen_last_sync_at' => [
                    'type' => 'DATETIME',
                    'null' => true,
                    'after' => 'max_payload_kg',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('vehicles') && $this->db->fieldExists('vegvesen_last_sync_at', 'vehicles')) {
            $this->forge->dropColumn('vehicles', ['vegvesen_last_sync_at', 'max_payload_kg']);
        }

        if ($this->db->tableExists('system_settings') && $this->db->fieldExists('vegvesen_api_key', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'vegvesen_api_key');
        }
    }
}
