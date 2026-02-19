<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class SystemSettingsSeeder extends Seeder
{
    public function run(): void
    {
        $this->db->table('system_settings')->replace([
            'id'                    => 1,
            'enable_local_login'    => 1,
            'enable_discord_login'  => 1,
            'enable_keycloak_login' => 1,
        ]);
    }
}

