<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\VehicleService;
use App\Services\CrewDirectoryService;
use App\Services\ProfileService;
use App\Repositories\UserRepository;

class VehiclesController extends BaseController
{
    public function __construct(
        private readonly VehicleService $vehicles = new VehicleService(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService(),
        private readonly ProfileService $profiles = new ProfileService(),
        private readonly UserRepository $users = new UserRepository()
    )
    {
    }

    public function index()
    {
        return view('vehicles/index', [
            'vehicles' => $this->vehicles->list(),
            'competencyRequirementOptions' => $this->vehicles->competencyRequirementOptions(),
            'competencyOverrideOptions' => $this->vehicles->competencyOverrideOptions(),
            'competencyOptions' => $this->vehicles->competencyOptions(),
            'canEditVehicles' => hasRole(['developer', 'chief', 'co-chief', 'skiftleder']),
            'canManageLoans' => hasRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']),
            'canCreateVehicles' => hasRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']),
        ]);
    }

    public function competencyProfile(int $wannabeId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']);
            $vehicleId = $this->request->getGet('vehicle_id');

            return $this->response->setJSON($this->vehicles->competencyProfile($wannabeId, $vehicleId !== null ? (int) $vehicleId : null));
        } catch (\Throwable $e) {
            return $this->response->setStatusCode(400)->setJSON(['error' => $e->getMessage()]);
        }
    }

    public function profile(int $wannabeId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']);

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
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']);

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

    public function create()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']);
            $this->vehicles->create($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/vehicles')->with('message', 'Kjøretøy opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function update(int $vehicleId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder']);
            $this->vehicles->update($vehicleId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/vehicles')->with('message', 'Kjøretøy oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function issue()
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']);
            $this->vehicles->issue($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/vehicles')->with('message', 'Kjøretøy utlånt.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function returnLoan(int $loanId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder', 'logistikk']);
            $this->vehicles->returnLoan($loanId, (int) $this->session->get('user_id'));

            return redirect()->to('/vehicles')->with('message', 'Kjøretøy returnert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function delete(int $vehicleId)
    {
        try {
            requireRole(['developer', 'chief', 'co-chief', 'skiftleder']);
            $this->vehicles->delete($vehicleId, (int) $this->session->get('user_id'));

            return redirect()->to('/vehicles')->with('message', 'Kjøretøy slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
