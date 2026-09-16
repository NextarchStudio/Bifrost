<?php
declare(strict_types=1);

namespace App\Models;

use CodeIgniter\Model;

class FeedbackNotificationReadModel extends Model
{
    protected $table = 'feedback_notification_reads';
    protected $primaryKey = 'id';
    protected $returnType = 'array';
    protected $allowedFields = ['notification_id', 'user_id', 'seen_at'];
    protected $useTimestamps = false;
}
