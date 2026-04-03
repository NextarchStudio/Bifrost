<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class RolesSeeder extends Seeder
{
    public function run(): void
    {
        $roles = ['developer', 'chief', 'co-chief', 'transport_ansvarlig', 'skiftleder', 'sambandsansvarlig', 'logistikk', 'shop', 'innkjop', 'bruker', 'ingen_tilbakemeldinger'];
        $hasWannabeRoleName = $this->db->fieldExists('wannabe_role_name', 'roles');
        $hasDisplayName = $this->db->fieldExists('display_name', 'roles');
        foreach ($roles as $name) {
            $exists = $this->db->table('roles')->where('name', $name)->get()->getFirstRow();
            if ($exists === null) {
                $payload = ['name' => $name];
                if ($hasWannabeRoleName) {
                    $payload['wannabe_role_name'] = null;
                }
                if ($hasDisplayName) {
                    $payload['display_name'] = match ($name) {
                        'developer' => 'Utvikler',
                        'chief' => 'Chief',
                        'co-chief' => 'Co-Chief',
                        'transport_ansvarlig' => 'Transport Ansvarlig',
                        'skiftleder' => 'Skiftleder',
                        'sambandsansvarlig' => 'Sambandsansvarlig',
                        'logistikk' => 'Logistikk',
                        'shop' => 'Shop',
                        'innkjop' => 'Innkjøp',
                        'bruker' => 'Bruker',
                        'ingen_tilbakemeldinger' => 'Felles Bruker',
                        default => $name,
                    };
                }
                $this->db->table('roles')->insert($payload);
            }
        }
    }
}
