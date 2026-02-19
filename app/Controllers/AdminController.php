<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\AdminService;

class AdminController extends BaseController
{
    public function __construct(private readonly AdminService $admin = new AdminService())
    {
    }

    public function index()
    {
        $data = $this->admin->panelData();
        $data['inspectedUser'] = null;
        $data['editUser'] = null;
        $data['editRoleIds'] = [];

        return view('admin/index', $data);
    }

    public function updateSettings()
    {
        try {
            $this->admin->updateSettings($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/admin')->with('message', 'Innstillinger oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function createUser()
    {
        try {
            $this->admin->createUser($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/admin')->with('message', 'Bruker opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function syncUserRoles(int $userId)
    {
        try {
            $roles = (array) $this->request->getPost('role_ids');
            $this->admin->syncUserRoles($userId, $roles, (int) $this->session->get('user_id'));
            return redirect()->to('/admin')->with('message', 'Roller oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function inspectUser(int $userId)
    {
        try {
            $data = $this->admin->panelData();
            $data['inspectedUser'] = $this->admin->userDetails($userId);
            $data['editUser'] = null;
            $data['editRoleIds'] = [];

            return view('admin/index', $data);
        } catch (\Throwable $e) {
            return redirect()->to('/admin')->with('error', $e->getMessage());
        }
    }

    public function editUser(int $userId)
    {
        try {
            $details = $this->admin->userDetails($userId);
            $data = $this->admin->panelData();
            $data['inspectedUser'] = null;
            $data['editUser'] = $details['user'];
            $data['editRoleIds'] = $details['roleIds'];

            return view('admin/index', $data);
        } catch (\Throwable $e) {
            return redirect()->to('/admin')->with('error', $e->getMessage());
        }
    }
}
