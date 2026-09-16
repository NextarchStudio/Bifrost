<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\LoanService;
use App\Services\CrewDirectoryService;
use App\Services\PrivateEquipmentService;
use App\Services\ProfileService;
use App\Repositories\UserRepository;

class LoansController extends BaseController
{
    public function __construct(
        private readonly LoanService $loans = new LoanService(),
        private readonly PrivateEquipmentService $privateEquipment = new PrivateEquipmentService(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly ProfileService $profiles = new ProfileService(),
        private readonly UserRepository $users = new UserRepository()
    ) {
    }

    public function index()
    {
        $search = trim((string) $this->request->getGet('q'));

        return view('loans/index', [
            'activeLoans' => $this->loans->active(),
            'loanableEquipment' => $this->loans->loanableEquipment(),
            'privateEquipmentRules' => $this->privateEquipment->loanNoticeRules(),
            'search' => $search,
        ]);
    }

    public function issue()
    {
        try {
            $this->loans->issue($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/loans')->with('message', 'Lån registrert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function profile(int $wannabeId)
    {
        if ($wannabeId < 1) {
            return $this->response->setStatusCode(400)->setJSON([
                'ok' => false,
                'message' => 'Ugyldig Wannabe ID.',
            ]);
        }

        if (! $this->crewDirectory->isConfigured()) {
            return $this->response->setStatusCode(503)->setJSON([
                'ok' => false,
                'message' => 'Crew-oppslag er ikke konfigurert.',
            ]);
        }

        $profile = $this->crewDirectory->profileByWannabeId($wannabeId);
        if ($profile === null) {
            $user = $this->users->findByWannabeId($wannabeId);
            if ($user === null) {
                return $this->response->setStatusCode(404)->setJSON([
                    'ok' => false,
                    'message' => 'Fant ikke person for denne Wannabe ID-en.',
                ]);
            }

            $name = trim((string) ($user->name ?? (($user->first_name ?? '') . ' ' . ($user->last_name ?? ''))));

            return $this->response->setJSON([
                'ok' => true,
                'id' => $wannabeId,
                'name' => $name,
                'nick' => '',
                'crew' => '',
                'role' => '',
                'displayName' => $name !== '' ? $name : ('Wannabe ' . $wannabeId),
                'pictureUrl' => null,
                'source' => 'local',
            ]);
        }

        $name = trim((string) ($profile['name'] ?? ''));
        $nick = trim((string) ($profile['nickname'] ?? $profile['nick'] ?? ''));
        $crew = trim((string) ($profile['crew_name'] ?? $profile['crew'] ?? ''));
        $role = trim((string) (($profile['crew_role']['title'] ?? null) ?? ($profile['role'] ?? $profile['rolle'] ?? '')));

        return $this->response->setJSON([
            'ok' => true,
            'id' => (int) ($profile['id'] ?? $wannabeId),
            'name' => $name,
            'nick' => $nick,
            'crew' => $crew,
            'role' => $role,
            'displayName' => $name !== '' ? $name : ($nick !== '' ? $nick : ('Wannabe ' . $wannabeId)),
            'pictureUrl' => $this->profiles->canShowPictureForWannabeId($wannabeId)
                ? $this->crewDirectory->pictureUrlByWannabeId($wannabeId)
                : null,
        ]);
    }

    public function profileLookup()
    {
        $query = trim((string) $this->request->getGet('q'));
        if ($query === '') {
            return $this->response->setStatusCode(400)->setJSON([
                'ok' => false,
                'message' => 'Mangler Wannabe ID eller badge-scan.',
            ]);
        }

        if (ctype_digit($query)) {
            return $this->profile((int) $query);
        }

        if (! $this->crewDirectory->isConfigured()) {
            return $this->response->setStatusCode(503)->setJSON([
                'ok' => false,
                'message' => 'Crew-oppslag er ikke konfigurert.',
            ]);
        }

        $profile = $this->crewDirectory->profileByBadge($query);
        if ($profile === null) {
            return $this->response->setStatusCode(404)->setJSON([
                'ok' => false,
                'message' => 'Fant ikke person for denne badge-scannen.',
            ]);
        }

        $wannabeId = (int) ($profile['id'] ?? 0);
        $name = trim((string) ($profile['name'] ?? ''));
        $nick = trim((string) ($profile['nickname'] ?? $profile['nick'] ?? ''));
        $crew = trim((string) ($profile['crew_name'] ?? $profile['crew'] ?? ''));
        $role = trim((string) (($profile['crew_role']['title'] ?? null) ?? ($profile['role'] ?? $profile['rolle'] ?? '')));

        return $this->response->setJSON([
            'ok' => true,
            'id' => $wannabeId,
            'name' => $name,
            'nick' => $nick,
            'crew' => $crew,
            'role' => $role,
            'displayName' => $name !== '' ? $name : ($nick !== '' ? $nick : ($wannabeId > 0 ? ('Wannabe ' . $wannabeId) : 'Ukjent bruker')),
            'pictureUrl' => ($wannabeId > 0 && $this->profiles->canShowPictureForWannabeId($wannabeId))
                ? $this->crewDirectory->pictureUrlByWannabeId($wannabeId)
                : null,
        ]);
    }

    public function returnLoan(int $loanId)
    {
        try {
            $result = $this->loans->returnLoan($loanId, (array) $this->request->getPost(), (int) $this->session->get('user_id'));

            if ($this->request->isAJAX()) {
                return $this->response->setJSON([
                    'ok' => true,
                    'message' => 'Utstyr returnert.',
                    'loan' => $result,
                    'csrfName' => csrf_token(),
                    'csrfHash' => csrf_hash(),
                ]);
            }

            return redirect()->to('/loans')->with('message', 'Utstyr returnert.');
        } catch (\Throwable $e) {
            if ($this->request->isAJAX()) {
                return $this->response
                    ->setStatusCode(400)
                    ->setJSON([
                        'ok' => false,
                        'message' => $e->getMessage(),
                        'csrfName' => csrf_token(),
                        'csrfHash' => csrf_hash(),
                    ]);
            }

            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
