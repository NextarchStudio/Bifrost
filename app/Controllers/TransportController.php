<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Repositories\UserRepository;
use App\Repositories\WarehouseRepository;
use App\Services\TransportService;

class TransportController extends BaseController
{
    public function __construct(
        private readonly TransportService $transport = new TransportService(),
        private readonly WarehouseRepository $warehouse = new WarehouseRepository(),
        private readonly UserRepository $users = new UserRepository()
    ) {
    }

    public function index()
    {
        $canManageTransport = hasRole(['developer', 'chief', 'co-chief', 'logistikk']);
        $isLogistics = $canManageTransport || hasRole('logistikk');
        $userId = (int) $this->session->get('user_id');
        $users = $canManageTransport ? $this->users->all() : [];
        $jobs = $isLogistics ? $this->transport->active() : $this->transport->mine($userId);

        return view('transport/index', [
            'jobs' => $jobs,
            'completedJobs' => $isLogistics ? $this->transport->completed() : $this->transport->completedMine($userId),
            'transportLocations' => $this->warehouse->transportLocations(),
            'allLocations' => $this->warehouse->locations(),
            'nonTransportLocations' => $this->warehouse->nonTransportLocations(),
            'users' => $users,
            'eligibleAssigneesByJob' => $canManageTransport ? $this->transport->eligibleAssigneesByJob($jobs, $users) : [],
            'vehicles' => $canManageTransport ? $this->transport->availableVehicles() : [],
            'isLogistics' => $isLogistics,
            'canManageTransport' => $canManageTransport,
            'canCreateTransportJobs' => $canManageTransport,
            'canRequestTransport' => ! $isLogistics && ! hasRole('sambandsansvarlig'),
            'currentUserId' => $userId,
            'inspection' => null,
        ]);
    }

    public function inspect(int $jobId)
    {
        try {
            $canManageTransport = hasRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $isLogistics = $canManageTransport || hasRole('logistikk');
            $userId = (int) $this->session->get('user_id');
            $users = $canManageTransport ? $this->users->all() : [];
            $jobs = $isLogistics ? $this->transport->active() : $this->transport->mine($userId);

            return view('transport/index', [
                'jobs' => $jobs,
                'completedJobs' => $isLogistics ? $this->transport->completed() : $this->transport->completedMine($userId),
                'transportLocations' => $this->warehouse->transportLocations(),
                'allLocations' => $this->warehouse->locations(),
                'nonTransportLocations' => $this->warehouse->nonTransportLocations(),
                'users' => $users,
                'eligibleAssigneesByJob' => $canManageTransport ? $this->transport->eligibleAssigneesByJob($jobs, $users) : [],
                'vehicles' => $canManageTransport ? $this->transport->availableVehicles() : [],
                'isLogistics' => $isLogistics,
                'canManageTransport' => $canManageTransport,
                'canCreateTransportJobs' => $canManageTransport,
                'canRequestTransport' => ! $isLogistics && ! hasRole('sambandsansvarlig'),
                'currentUserId' => $userId,
                'inspection' => $this->transport->inspect($jobId, $isLogistics, $userId),
            ]);
        } catch (\Throwable $e) {
            return redirect()->to('/transport')->with('error', $e->getMessage());
        }
    }

    public function create()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $this->transport->createEquipmentJob($this->request->getPost(), (int) $this->session->get('user_id'));
            return redirect()->to('/transport')->with('message', 'Oppdrag opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function requestPeople()
    {
        try {
            if (hasRole(['developer', 'chief', 'co-chief', 'logistikk', 'sambandsansvarlig'])) {
                throw new \RuntimeException('Denne rollen kan ikke opprette transportforespørsler.');
            }

            $this->transport->requestPeopleTransport($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/transport')->with('message', 'Transportforespørsel for folk sendt.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function assign(int $jobId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $this->transport->assign($jobId, (int) $this->request->getPost('assigned_user_id'), (int) $this->session->get('user_id'));
            return redirect()->to('/transport')->with('message', 'Oppdrag tildelt.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function status(int $jobId)
    {
        try {
            $actorUserId = (int) $this->session->get('user_id');
            $canManageTransport = hasRole(['developer', 'chief', 'co-chief', 'logistikk']);
            if (! $canManageTransport) {
                throw new \RuntimeException('Forbidden');
            }

            $this->transport->updateStatus($jobId, (array) $this->request->getPost(), $actorUserId);
            return redirect()->to('/transport')->with('message', 'Status oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }
}
