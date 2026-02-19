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
        $canManageTransport = hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
        $isLogistics = $canManageTransport || hasRole('logistikk');
        $userId = (int) $this->session->get('user_id');

        return view('transport/index', [
            'jobs'      => $isLogistics ? $this->transport->active() : $this->transport->mine($userId),
            'transportLocations' => $this->warehouse->transportLocations(),
            'nonTransportLocations' => $this->warehouse->nonTransportLocations(),
            'users'     => $canManageTransport ? $this->users->all() : [],
            'equipment' => $canManageTransport ? $this->equipment->allWithContext() : [],
            'isLogistics' => $isLogistics,
            'canManageTransport' => $canManageTransport,
            'currentUserId' => $userId,
            'inspection' => null,
        ]);
    }

    public function inspect(int $jobId)
    {
        try {
            $canManageTransport = hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
            $isLogistics = $canManageTransport || hasRole('logistikk');
            $userId = (int) $this->session->get('user_id');

            return view('transport/index', [
                'jobs'      => $isLogistics ? $this->transport->active() : $this->transport->mine($userId),
                'transportLocations' => $this->warehouse->transportLocations(),
                'nonTransportLocations' => $this->warehouse->nonTransportLocations(),
                'users'     => $canManageTransport ? $this->users->all() : [],
                'equipment' => $canManageTransport ? $this->equipment->allWithContext() : [],
                'isLogistics' => $isLogistics,
                'canManageTransport' => $canManageTransport,
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
            if (hasRole('logistikk')) {
                throw new \RuntimeException('Logistikk kan ikke opprette transportforespørsler.');
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
            $actorUserId = (int) $this->session->get('user_id');
            $status = (string) $this->request->getPost('status');
            $canManageTransport = hasRole(['developer', 'chief', 'co-chief', 'transport_ansvarlig']);
            if (! $canManageTransport) {
                if (! hasRole('logistikk')) {
                    throw new \RuntimeException('Forbidden');
                }
                $job = $this->transport->findById($jobId);
                if ($job === null) {
                    throw new \InvalidArgumentException('Oppdrag finnes ikke.');
                }
                if ((int) ($job->assigned_user_id ?? 0) !== $actorUserId) {
                    throw new \RuntimeException('Du kan kun oppdatere oppdrag som er tildelt deg.');
                }
                if (! in_array($status, ['in_progress', 'completed'], true)) {
                    throw new \RuntimeException('Logistikk kan kun starte eller fullføre oppdrag.');
                }
            }

            $this->transport->updateStatus($jobId, $status, $actorUserId);
            return redirect()->to('/transport')->with('message', 'Status oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
