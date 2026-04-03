<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = ['developer', 'chief', 'co-chief', 'transport_ansvarlig', 'skiftleder', 'sambandsansvarlig', 'logistikk', 'shop', 'innkjop', 'bruker', 'ingen_tilbakemeldinger'];
        foreach ($roles as $name) {
            $exists = $this->db->table('roles')->where('name', $name)->get()->getFirstRow();
            if ($exists === null) {
                $this->db->table('roles')->insert(['name' => $name]);
            }
        }
    }
}
