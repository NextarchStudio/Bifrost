<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call(RolesSeeder::class);
        $this->call(SystemSettingsSeeder::class);
        $this->call(AdminUserSeeder::class);
        $this->call(SampleWarehouseSeeder::class);
    }
}

