<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCrewCacheYearToSystemSettings extends Migration
{
    public function up()
    {
        if (! $this->db->fieldExists('crew_cache_year', 'system_settings')) {
            $this->forge->addColumn('system_settings', [
                'crew_cache_year' => [
                    'type' => 'INT',
                    'constraint' => 4,
                    'null' => true,
                    'after' => 'crew_api_bearer_token',
                ],
            ]);

            $this->db->table('system_settings')
                ->set('crew_cache_year', (int) date('Y'))
                ->update();
        }
    }

    public function down()
    {
        if ($this->db->fieldExists('crew_cache_year', 'system_settings')) {
            $this->forge->dropColumn('system_settings', 'crew_cache_year');
        }
    }
}
