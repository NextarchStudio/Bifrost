<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\CommsService;
use App\Services\CrewDirectoryService;
use App\Services\ProfileService;
use App\Repositories\UserRepository;

class CommsController extends BaseController
{
    public function __construct(
        private readonly CommsService $comms = new CommsService(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly ProfileService $profiles = new ProfileService(),
        private readonly UserRepository $users = new UserRepository()
    )
    {
    }

    public function index()
    {
        return view('comms/index', $this->comms->pageData());
    }

    public function createItem()
    {
        try {
            $this->comms->createItem($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Samband/tilbehør opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function createSet()
    {
        try {
            $this->comms->createSet($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Sambandssett opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function updateSet(int $setId)
    {
        try {
            $this->comms->updateSet($setId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Sambandssett oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function deleteSet(int $setId)
    {
        try {
            $this->comms->deleteSet($setId, (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Sambandssett slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function issue()
    {
        try {
            $this->comms->issue($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Samband-lån registrert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function profile(int $wannabeId)
    {
        try {
            if ($wannabeId < 1) {
                throw new \InvalidArgumentException('Ugyldig Wannabe ID.');
            }

            if (! $this->crewDirectory->isConfigured()) {
                throw new \InvalidArgumentException('Crew-oppslag er ikke konfigurert.');
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
        } catch (\Throwable $e) {
            return $this->response->setStatusCode(400)->setJSON([
                'ok' => false,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function profileLookup()
    {
        try {
            $query = trim((string) $this->request->getGet('q'));
            if ($query === '') {
                throw new \InvalidArgumentException('Mangler Wannabe ID eller badge-scan.');
            }

            if (ctype_digit($query)) {
                return $this->profile((int) $query);
            }

            if (! $this->crewDirectory->isConfigured()) {
                throw new \InvalidArgumentException('Crew-oppslag er ikke konfigurert.');
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
        } catch (\Throwable $e) {
            return $this->response->setStatusCode(400)->setJSON([
                'ok' => false,
                'message' => $e->getMessage(),
            ]);
        }
    }

    public function returnLoan(int $loanId)
    {
        try {
            $this->comms->returnLoan($loanId, (array) $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Samband-lån returnert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
