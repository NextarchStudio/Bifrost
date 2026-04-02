<?php
declare(strict_types=1);

namespace App\Database\Migrations;

use CodeIgniter\Database\Migration;

class AddAttachmentToFeedbackEntries extends Migration
{
    public function up(): void
    {
        if (! $this->db->tableExists('feedback_entries')) {
            return;
        }

        $fields = [];

        if (! $this->db->fieldExists('attachment_path', 'feedback_entries')) {
            $fields['attachment_path'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'needs_database_fix'];
        }

        if (! $this->db->fieldExists('attachment_original_name', 'feedback_entries')) {
            $fields['attachment_original_name'] = ['type' => 'VARCHAR', 'constraint' => 255, 'null' => true, 'after' => 'attachment_path'];
        }

        if (! $this->db->fieldExists('attachment_mime', 'feedback_entries')) {
            $fields['attachment_mime'] = ['type' => 'VARCHAR', 'constraint' => 120, 'null' => true, 'after' => 'attachment_original_name'];
        }

        if ($fields !== []) {
            $this->forge->addColumn('feedback_entries', $fields);
        }
    }

    public function down(): void
    {
        if (! $this->db->tableExists('feedback_entries')) {
            return;
        }

        foreach (['attachment_mime', 'attachment_original_name', 'attachment_path'] as $field) {
            if ($this->db->fieldExists($field, 'feedback_entries')) {
                $this->forge->dropColumn('feedback_entries', $field);
            }
        }
    }
}
