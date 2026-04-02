<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class FeedbackNotificationModel extends Model
{
    protected $table = 'feedback_notifications';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['feedback_entry_id', 'status', 'title', 'message', 'created_at'];
    protected $useTimestamps = false;
}
