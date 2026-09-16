<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\DashboardService;

class DashboardController extends BaseController
{
    public function __construct(private readonly DashboardService $dashboard = new DashboardService())
    {
    }

    public function index()
    {
        return view('dashboard/index', ['summary' => $this->dashboard->summary()]);
    }
}

