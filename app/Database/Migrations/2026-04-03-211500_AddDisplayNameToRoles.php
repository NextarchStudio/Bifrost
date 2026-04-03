<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddDisplayNameToRoles extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('roles')) {
            return;
        }

        if (! $this->db->fieldExists('display_name', 'roles')) {
            $this->forge->addColumn('roles', [
                'display_name' => [
                    'type' => 'VARCHAR',
                    'constraint' => 100,
                    'null' => true,
                    'after' => 'wannabe_role_name',
                ],
            ]);
        }

        $defaults = [
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
        ];

        foreach ($defaults as $name => $displayName) {
            $this->db->table('roles')
                ->where('name', $name)
                ->where('display_name IS NULL', null, false)
                ->update(['display_name' => $displayName]);
        }
    }

    public function down(): void
    {
        if ($this->db->tableExists('roles') && $this->db->fieldExists('display_name', 'roles')) {
            $this->forge->dropColumn('roles', 'display_name');
        }
    }
}
