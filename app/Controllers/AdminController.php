<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\AdminService;
use App\Services\CrewClothingService;

class AdminController extends BaseController
{
    public function __construct(
        private readonly AdminService $admin = new AdminService(),
        private readonly CrewClothingService $crewClothing = new CrewClothingService()
    )
    {
    }

    public function index()
    {
        $data = $this->admin->panelData();
        $data['inspectedUser'] = null;
        $data['editUser'] = null;
        $data['editRoleIds'] = [];
        $data['editCompetencies'] = [];

        return view('admin/index', $data);
    }

    public function statistics()
    {
        return view('admin/statistics', $this->admin->statisticsData());
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
            return redirect()->to('/admin')->with('message', 'Bruker opprettet og e-post med passordlenke er sendt.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function createCrewClothingCrew()
    {
        try {
            $this->crewClothing->createCrew($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/admin')->with('message', 'Crew opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function createRole()
    {
        try {
            $this->admin->createRole($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/admin')->with('message', 'Rolle opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function updateRole(int $roleId)
    {
        try {
            $this->admin->updateRole($roleId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/admin')->with('message', 'Rolle oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function deleteRole(int $roleId)
    {
        try {
            $this->admin->deleteRole($roleId, (int) $this->session->get('user_id'));

            return redirect()->to('/admin')->with('message', 'Rolle slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function updateCrewClothingCrew(int $crewId)
    {
        try {
            $this->crewClothing->updateCrew($crewId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/admin')->with('message', 'Crew oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function clearCrewCache()
    {
        try {
            $this->admin->clearCrewCache((int) $this->session->get('user_id'));
            return redirect()->to('/admin')->with('message', 'Crew-cache er tømt.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
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

    public function updateUserActive(int $userId)
    {
        try {
            $active = (string) $this->request->getPost('active') === '1';
            $this->admin->updateUserActive($userId, $active, (int) $this->session->get('user_id'));
            return redirect()->to('/admin/users/edit/' . $userId)->with('message', 'Brukerstatus oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function updateUserCompetencies(int $userId)
    {
        try {
            $this->admin->updateUserCompetencies($userId, $this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/admin/users/edit/' . $userId)->with('message', 'Sertifikater og kompetanse oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function deleteUser(int $userId)
    {
        try {
            $this->admin->deleteUser($userId, (int) $this->session->get('user_id'));
            return redirect()->to('/admin')->with('message', 'Bruker slettet.');
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
            $data['editCompetencies'] = $details['competencies'];

            return view('admin/index', $data);
        } catch (\Throwable $e) {
            return redirect()->to('/admin')->with('error', $e->getMessage());
        }
    }
}
