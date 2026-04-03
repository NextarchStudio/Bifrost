<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\CrewClothingService;

class CrewClothingController extends BaseController
{
    public function __construct(private readonly CrewClothingService $crewClothing = new CrewClothingService())
    {
    }

    public function index()
    {
        $memberId = (int) ($this->session->getFlashdata('crew_clothing_selected_member_id') ?? 0);
        $selectedMember = $memberId > 0 ? $this->crewClothing->memberById($memberId) : null;
        $lookupError = (string) ($this->session->getFlashdata('crew_clothing_lookup_error') ?? '');
        $data = $this->crewClothing->data();
        $data['selectedMember'] = $selectedMember;
        $data['lookupQuery'] = '';
        $data['lookupError'] = $lookupError;

        return view('shop/crew_clothing', $data);
    }

    public function search()
    {
        try {
            $member = $this->crewClothing->lookupMember((string) $this->request->getPost('q'));
            $memberId = (int) ($member['id'] ?? 0);
            if ($memberId > 0) {
                $this->session->setFlashdata('crew_clothing_selected_member_id', $memberId);
            }

            return redirect()->to('/shop/crewtoy');
        } catch (\Throwable $e) {
            $this->session->setFlashdata('crew_clothing_lookup_error', $e->getMessage());

            return redirect()->to('/shop/crewtoy')->withInput();
        }
    }

    public function updateMember(int $memberId)
    {
        try {
            $this->crewClothing->updateMember($memberId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->back()->with('message', 'Crewmedlem oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function setDelivered(int $memberId, string $itemType)
    {
        try {
            $this->crewClothing->setDelivered(
                $memberId,
                $itemType,
                (string) $this->request->getPost('delivered') === '1',
                (int) $this->session->get('user_id')
            );

            return redirect()->back()->with('message', 'Utleveringsstatus oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function setDeliveredBoth(int $memberId)
    {
        try {
            $delivered = (string) $this->request->getPost('delivered') === '1';
            $actorUserId = (int) $this->session->get('user_id');

            $this->crewClothing->setDelivered($memberId, 'hoodie', $delivered, $actorUserId);
            $this->crewClothing->setDelivered($memberId, 'tshirt', $delivered, $actorUserId);

            return redirect()->back()->with('message', 'Utleveringsstatus oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function saveInventory()
    {
        try {
            $this->crewClothing->saveInventory($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/shop/crewtoy')->with('message', 'Varebeholdning oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function updateInventory(int $inventoryId)
    {
        try {
            $this->crewClothing->updateInventory($inventoryId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/shop/crewtoy')->with('message', 'Varelinje oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function deleteInventory(int $inventoryId)
    {
        try {
            $this->crewClothing->deleteInventory($inventoryId, (int) $this->session->get('user_id'));

            return redirect()->to('/shop/crewtoy')->with('message', 'Varelinje slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }
}
