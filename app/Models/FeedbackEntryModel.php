<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class FeedbackEntryModel extends Model
{
    protected $table = 'feedback_entries';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = [
        'requester_user_id',
        'wannabe_id',
        'requester_name',
        'type',
        'title',
        'description',
        'needs_database_fix',
        'attachment_path',
        'attachment_original_name',
        'attachment_mime',
        'status',
        'developer_note',
        'resolved_at',
        'added_at',
        'created_at',
        'updated_at',
    ];
    protected $useTimestamps = false;
}
