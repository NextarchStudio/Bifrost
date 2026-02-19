<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddPeopleTransportRequestFields extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('transport_jobs');

        if (! in_array('transport_type', $fields, true)) {
            $this->forge->addColumn('transport_jobs', [
                'transport_type' => ['type' => 'VARCHAR', 'constraint' => 20, 'default' => 'equipment', 'after' => 'to_location_id'],
            ]);
        }
        if (! in_array('people_count', $fields, true)) {
            $this->forge->addColumn('transport_jobs', [
                'people_count' => ['type' => 'SMALLINT', 'unsigned' => true, 'null' => true, 'after' => 'transport_type'],
            ]);
        }
        if (! in_array('requester_user_id', $fields, true)) {
            $this->forge->addColumn('transport_jobs', [
                'requester_user_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true, 'after' => 'equipment_id'],
            ]);
        }

        try {
            $this->db->query('ALTER TABLE transport_jobs ADD INDEX transport_jobs_transport_type_index (transport_type)');
        } catch (\Throwable) {
        }
        try {
            $this->db->query('ALTER TABLE transport_jobs ADD INDEX transport_jobs_requester_user_id_index (requester_user_id)');
        } catch (\Throwable) {
        }
        try {
            $this->db->query('ALTER TABLE transport_jobs ADD CONSTRAINT transport_jobs_requester_user_id_foreign FOREIGN KEY (requester_user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE SET NULL');
        } catch (\Throwable) {
        }
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('transport_jobs');

        try {
            $this->db->query('ALTER TABLE transport_jobs DROP FOREIGN KEY transport_jobs_requester_user_id_foreign');
        } catch (\Throwable) {
        }
        try {
            $this->db->query('ALTER TABLE transport_jobs DROP INDEX transport_jobs_requester_user_id_index');
        } catch (\Throwable) {
        }
        try {
            $this->db->query('ALTER TABLE transport_jobs DROP INDEX transport_jobs_transport_type_index');
        } catch (\Throwable) {
        }

        if (in_array('requester_user_id', $fields, true)) {
            $this->forge->dropColumn('transport_jobs', 'requester_user_id');
        }
        if (in_array('people_count', $fields, true)) {
            $this->forge->dropColumn('transport_jobs', 'people_count');
        }
        if (in_array('transport_type', $fields, true)) {
            $this->forge->dropColumn('transport_jobs', 'transport_type');
        }
    }
}

