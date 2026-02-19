<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddFirstAndLastNameToUsers extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('users');

        if (! in_array('first_name', $fields, true)) {
            $this->forge->addColumn('users', [
                'first_name' => ['type' => 'VARCHAR', 'constraint' => 80, 'null' => false, 'default' => ''],
            ]);
        }

        if (! in_array('last_name', $fields, true)) {
            $this->forge->addColumn('users', [
                'last_name' => ['type' => 'VARCHAR', 'constraint' => 80, 'null' => false, 'default' => ''],
            ]);
        }

        $this->db->query(
            "UPDATE users 
             SET first_name = TRIM(SUBSTRING_INDEX(name, ' ', 1)),
                 last_name = TRIM(SUBSTRING(name, LENGTH(SUBSTRING_INDEX(name, ' ', 1)) + 1))
             WHERE (first_name = '' OR first_name IS NULL)
                OR (last_name = '' OR last_name IS NULL)"
        );
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('users');
        if (in_array('first_name', $fields, true)) {
            $this->forge->dropColumn('users', 'first_name');
        }
        if (in_array('last_name', $fields, true)) {
            $this->forge->dropColumn('users', 'last_name');
        }
    }
}

