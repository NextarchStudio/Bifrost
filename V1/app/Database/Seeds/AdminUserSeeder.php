<?php
declare(strict_types=1);

namespace App\Database\Seeds;

use CodeIgniter\Database\Seeder;

class AdminUserSeeder extends Seeder
{
    public function run(): void
    {
        $now = date('Y-m-d H:i:s');
        $email = 'admin@tg-logistics.local';

        $user = $this->db->table('users')->where('email', $email)->get()->getFirstRow();
        if ($user === null) {
            $this->db->table('users')->insert([
                'name'          => 'TG Admin',
                'first_name'    => 'TG',
                'last_name'     => 'Admin',
                'email'         => $email,
                'wannabe_id'    => 10001,
                'password_hash' => password_hash('ChangeMe1234!', PASSWORD_ARGON2ID),
                'active'        => 1,
                'created_at'    => $now,
                'updated_at'    => $now,
            ]);
            $userId = (int) $this->db->insertID();
        } else {
            $userId = (int) $user->id;
            $this->db->table('users')->where('id', $userId)->update([
                'first_name' => 'TG',
                'last_name'  => 'Admin',
                'name'       => 'TG Admin',
                'updated_at' => $now,
            ]);
        }

        $developerRole = $this->db->table('roles')->where('name', 'developer')->get()->getFirstRow();
        $chiefRole = $this->db->table('roles')->where('name', 'chief')->get()->getFirstRow();

        if ($developerRole !== null) {
            $this->db->table('user_roles')->replace(['user_id' => $userId, 'role_id' => (int) $developerRole->id]);
        }
        if ($chiefRole !== null) {
            $this->db->table('user_roles')->replace(['user_id' => $userId, 'role_id' => (int) $chiefRole->id]);
        }
    }
}
