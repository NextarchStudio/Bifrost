<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\TaskService;

class TasksController extends BaseController
{
    public function __construct(private readonly TaskService $tasks = new TaskService())
    {
    }

    public function index()
    {
        $canManageAll = hasRole(['developer', 'chief', 'co-chief', 'logistikk']);

        return view('tasks/index', $this->tasks->pageData((int) $this->session->get('user_id'), $canManageAll));
    }

    public function create()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $this->tasks->create((array) $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/tasks')->with('message', 'Oppgave opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function updateStatus(int $taskId)
    {
        try {
            $this->tasks->updateStatus(
                $taskId,
                (array) $this->request->getPost(),
                (int) $this->session->get('user_id'),
                hasRole(['developer', 'chief', 'co-chief', 'logistikk'])
            );

            return redirect()->to('/tasks')->with('message', 'Oppgavestatus oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
