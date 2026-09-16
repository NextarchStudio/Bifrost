<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddRequestIdToEquipmentLoans extends Migration
{
    public function up(): void
    {
        $fields = $this->db->getFieldNames('equipment_loans');
        if (! in_array('request_id', $fields, true)) {
            $this->forge->addColumn('equipment_loans', [
                'request_id' => ['type' => 'BIGINT', 'unsigned' => true, 'null' => true, 'after' => 'quantity'],
            ]);
        }

        try {
            $this->db->query('ALTER TABLE equipment_loans ADD INDEX equipment_loans_request_id_index (request_id)');
        } catch (\Throwable) {
        }

        try {
            $this->db->query('ALTER TABLE equipment_loans ADD CONSTRAINT equipment_loans_request_id_foreign FOREIGN KEY (request_id) REFERENCES equipment_requests(id) ON DELETE SET NULL ON UPDATE CASCADE');
        } catch (\Throwable) {
        }
    }

    public function down(): void
    {
        $fields = $this->db->getFieldNames('equipment_loans');
        if (! in_array('request_id', $fields, true)) {
            return;
        }

        try {
            $this->db->query('ALTER TABLE equipment_loans DROP FOREIGN KEY equipment_loans_request_id_foreign');
        } catch (\Throwable) {
        }

        try {
            $this->db->query('ALTER TABLE equipment_loans DROP INDEX equipment_loans_request_id_index');
        } catch (\Throwable) {
        }

        $this->forge->dropColumn('equipment_loans', 'request_id');
    }
}

