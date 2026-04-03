<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddFaviconUrlToSystemSettings extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('system_settings')) {
            return;
        }

        if (! $this->db->fieldExists('favicon_url', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'favicon_url' => [
                    'type' => 'VARCHAR',
                    'constraint' => 255,
                    'null' => true,
                    'after' => 'logo_url',
                ],
            ]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('system_settings') && $this->db->fieldExists('favicon_url', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'favicon_url');
        }
    }
}
