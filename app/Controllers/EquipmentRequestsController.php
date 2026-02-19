<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\EquipmentRequestService;

class EquipmentRequestsController extends BaseController
{
    public function __construct(private readonly EquipmentRequestService $requests = new EquipmentRequestService())
    {
    }

    public function index()
    {
        $isLogistics = hasRole(['developer', 'chief', 'co-chief', 'skiftleder', 'transport_ansvarlig']);
        $userId = (int) $this->session->get('user_id');

        return view('requests/index', [
            'equipment'    => $this->requests->equipmentForSelection(),
            'myRequests'   => $this->requests->mine($userId),
            'allRequests'  => $isLogistics ? $this->requests->allForLogistics() : [],
            'isLogistics'  => $isLogistics,
            'currentWannabeId' => $this->requests->currentWannabeIdForUser($userId),
        ]);
    }

    public function create()
    {
        try {
            $this->requests->create($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/requests')->with('message', 'Forespørsel sendt til logistikk.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function updateStatus(int $requestId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'transport_ansvarlig']);
            $status = (string) $this->request->getPost('status');
            $actorUserId = (int) $this->session->get('user_id');

            if ($status === 'approved') {
                $this->requests->approveAll($requestId, $actorUserId);

                return redirect()->to('/requests')->with('message', 'Forespørsel godkjent og registrert som utlån.');
            }

            $this->requests->updateStatus($requestId, $status, $actorUserId);

            return redirect()->to('/requests')->with('message', 'Status oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function approve(int $requestId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'transport_ansvarlig']);
            $approvedQuantities = [];
            foreach ((array) $this->request->getPost('approved_quantities') as $itemId => $qty) {
                $approvedQuantities[(int) $itemId] = max(0, (int) $qty);
            }
            $rejected = array_map(static fn ($id): int => (int) $id, (array) $this->request->getPost('rejected_items'));
            $this->requests->approvePartial($requestId, $approvedQuantities, $rejected, (int) $this->session->get('user_id'));

            return redirect()->to('/requests')->with('message', 'Forespørsel behandlet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
