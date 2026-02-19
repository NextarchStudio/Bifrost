<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Repositories\EquipmentRepository;
use App\Repositories\UserRepository;
use App\Repositories\WarehouseRepository;
use App\Services\TransportService;

class TransportController extends BaseController
{
    public function __construct(
        private readonly TransportService $transport = new TransportService(),
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly UserRepository $users = new UserRepository(),
        private readonly EquipmentRepository $equipment = new EquipmentRepository()
    ) {
    }

    public function index()
    {
        $isLogistics = hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
        $userId = (int) $this->session->get('user_id');

        return view('transport/index', [
            'jobs'      => $isLogistics ? $this->transport->active() : $this->transport->mine($userId),
            'transportLocations' => $this->warehouse->transportLocations(),
            'nonTransportLocations' => $this->warehouse->nonTransportLocations(),
            'users'     => $isLogistics ? $this->users->all() : [],
            'equipment' => $isLogistics ? $this->equipment->allWithContext() : [],
            'isLogistics' => $isLogistics,
            'inspection' => null,
        ]);
    }

    public function inspect(int $jobId)
    {
        try {
            $isLogistics = hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
            $userId = (int) $this->session->get('user_id');

            return view('transport/index', [
                'jobs'      => $isLogistics ? $this->transport->active() : $this->transport->mine($userId),
                'transportLocations' => $this->warehouse->transportLocations(),
                'nonTransportLocations' => $this->warehouse->nonTransportLocations(),
                'users'     => $isLogistics ? $this->users->all() : [],
                'equipment' => $isLogistics ? $this->equipment->allWithContext() : [],
                'isLogistics' => $isLogistics,
                'inspection' => $this->transport->inspect($jobId, $isLogistics, $userId),
            ]);
        } catch (\Throwable $e) {
            return redirect()->to('/transport')->with('error', $e->getMessage());
        }
    }

    public function create()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
            $this->transport->createEquipmentJob($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/transport')->with('message', 'Oppdrag opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function requestPeople()
    {
        try {
            $this->transport->requestPeopleTransport($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/transport')->with('message', 'Transportforespørsel for folk sendt.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function assign(int $jobId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
            $this->transport->assign($jobId, (int) $this->request->getPost('assigned_user_id'), (int) $this->session->get('user_id'));
            return redirect()->to('/transport')->with('message', 'Oppdrag tildelt.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function status(int $jobId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
            $this->transport->updateStatus($jobId, (string) $this->request->getPost('status'), (int) $this->session->get('user_id'));
            return redirect()->to('/transport')->with('message', 'Status oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
