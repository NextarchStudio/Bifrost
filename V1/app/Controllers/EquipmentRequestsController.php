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
        $canManageRequests = hasRole(['developer', 'chief', 'co-chief', 'logistikk']);
        $canViewIncoming = $canManageRequests;
        $canCreateRequest = ! hasRole(['developer', 'chief', 'co-chief', 'logistikk', 'sambandsansvarlig']);
        $userId = (int) $this->session->get('user_id');

        return view('requests/index', [
            'equipment' => $canCreateRequest ? $this->requests->equipmentForSelection() : [],
            'myRequests' => $this->requests->mine($userId),
            'allRequests' => $canViewIncoming ? $this->requests->allForLogistics() : [],
            'isLogistics' => $canViewIncoming,
            'canManageRequests' => $canManageRequests,
            'canCreateRequest' => $canCreateRequest,
            'currentWannabeId' => $this->requests->currentWannabeIdForUser($userId),
        ]);
    }

    public function create()
    {
        try {
            if (hasRole(['developer', 'chief', 'co-chief', 'logistikk', 'sambandsansvarlig'])) {
                throw new \RuntimeException('Denne rollen kan ikke opprette nye utstyrsforespørsler.');
            }

            $this->requests->create($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/requests')->with('message', 'Forespørsel sendt til logistikk.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function delete(int $requestId)
    {
        try {
            $canManageRequests = hasRole(['developer', 'chief', 'co-chief', 'logistikk']);
            $this->requests->delete($requestId, (int) $this->session->get('user_id'), $canManageRequests);

            return redirect()->to('/requests')->with('message', 'Forespørsel slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function updateStatus(int $requestId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
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
            requireRole(['developer', 'chief', 'co-chief', 'logistikk']);
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
