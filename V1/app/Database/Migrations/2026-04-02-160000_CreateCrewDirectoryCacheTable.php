<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class CreateCrewDirectoryCacheTable extends Migration
{
    public function up()
    {
        $this->forge->addField([
            'id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
                'auto_increment' => true,
            ],
            'wannabe_id' => [
                'type' => 'INT',
                'constraint' => 11,
                'unsigned' => true,
            ],
            'scan_number' => [
                'type' => 'VARCHAR',
                'constraint' => 64,
                'null' => true,
            ],
            'name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'nickname' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'crew_name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'crew_role_title' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'crew_role_name' => [
                'type' => 'VARCHAR',
                'constraint' => 255,
                'null' => true,
            ],
            'created_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
            'updated_at' => [
                'type' => 'DATETIME',
                'null' => false,
            ],
        ]);
        $this->forge->addKey('id', true);
        $this->forge->addUniqueKey('wannabe_id');
        $this->forge->addUniqueKey('scan_number');
        $this->forge->createTable('crew_directory_cache', true);
    }

    public function down()
    {
        $this->forge->dropTable('crew_directory_cache', true);
    }
}
