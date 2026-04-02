<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddKeycloakSettingsToSystemSettings extends Migration
{
    public function up(): void
    {
        $fields = [];

        if (! $this->db->fieldExists('keycloak_base_url', 'system_settings')) {
            $fields['keycloak_base_url'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'enable_keycloak_login'];
        }

        if (! $this->db->fieldExists('keycloak_realm', 'system_settings')) {
            $fields['keycloak_realm'] = ['type' => 'VARCHAR', 'constraint' => 180, 'null' => true, 'after' => 'keycloak_base_url'];
        }

        if (! $this->db->fieldExists('keycloak_client_id', 'system_settings')) {
            $fields['keycloak_client_id'] = ['type' => 'VARCHAR', 'constraint' => 180, 'null' => true, 'after' => 'keycloak_realm'];
        }

        if (! $this->db->fieldExists('keycloak_client_secret', 'system_settings')) {
            $fields['keycloak_client_secret'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'keycloak_client_id'];
        }

        if (! $this->db->fieldExists('keycloak_redirect_uri', 'system_settings')) {
            $fields['keycloak_redirect_uri'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'keycloak_client_secret'];
        }

        if ($fields !== []) {
            $this->forge->addColumn('system_settings', $fields);
        }
    }

    public function down(): void
    {
        foreach (['keycloak_redirect_uri', 'keycloak_client_secret', 'keycloak_client_id', 'keycloak_realm', 'keycloak_base_url'] as $field) {
            if ($this->db->fieldExists($field, 'system_settings')) {
                $this->forge->dropColumn('system_settings', $field);
            }
        }
    }
}
