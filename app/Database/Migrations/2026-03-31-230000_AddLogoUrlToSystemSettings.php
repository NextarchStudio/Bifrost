<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddLogoUrlToSystemSettings extends Migration
{
    public function up(): void
    {
        if ($this->db->tableExists('system_settings') && ! $this->db->fieldExists('logo_url', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'logo_url' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'osrm_base_url',
                ],
            ]);

            $this->db->table('system_settings')
                ->where('id', 1)
                ->update([
                    'logo_url' => 'https://www.tg.no/tg26/tg26_horizontal.svg',
                ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('system_settings') && $this->db->fieldExists('logo_url', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'logo_url');
        }
    }
}
