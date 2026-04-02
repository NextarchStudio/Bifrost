<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddCrewApiSettingsToSystemSettings extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('system_settings')) {
            return;
        }

        $fields = [];

        if (! $this->db->fieldExists('crew_api_base_url', 'system_settings')) {
            $fields['crew_api_base_url'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'keycloak_redirect_uri'];
        }
        if (! $this->db->fieldExists('crew_api_profile_endpoint', 'system_settings')) {
            $fields['crew_api_profile_endpoint'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'crew_api_base_url'];
        }
        if (! $this->db->fieldExists('crew_api_picture_endpoint', 'system_settings')) {
            $fields['crew_api_picture_endpoint'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'crew_api_profile_endpoint'];
        }
        if (! $this->db->fieldExists('crew_api_bearer_token', 'system_settings')) {
            $fields['crew_api_bearer_token'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'crew_api_picture_endpoint'];
        }

        if ($fields !== []) {
            $this->forge->addColumn('system_settings', $fields);
        }

        $this->db->table('system_settings')->where('id', 1)->update([
            'crew_api_base_url' => 'https://tgbt-idam.gathering.org',
            'crew_api_profile_endpoint' => '/v2/profile/',
            'crew_api_picture_endpoint' => '/v2/picture/',
        ]);
    }

    public function down(): void
    {
        if (! $this->db->tableExists('system_settings')) {
            return;
        }

        foreach (['crew_api_bearer_token', 'crew_api_picture_endpoint', 'crew_api_profile_endpoint', 'crew_api_base_url'] as $field) {
            if ($this->db->fieldExists($field, 'system_settings')) {
                $this->forge->dropColumn('system_settings', $field);
            }
        }
    }
}
