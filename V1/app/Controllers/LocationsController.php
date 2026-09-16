<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\LocationService;

class LocationsController extends BaseController
{
    public function __construct(private readonly LocationService $locations = new LocationService())
    {
    }

    public function index()
    {
        return view('locations/index', [
            'locations' => $this->locations->list(),
        ]);
    }

    public function create()
    {
        try {
            $this->locations->create($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/locations')->with('message', 'Lokasjon opprettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function update(int $locationId)
    {
        try {
            $this->locations->update($locationId, $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/locations')->with('message', 'Lokasjon oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function delete(int $locationId)
    {
        try {
            $this->locations->delete($locationId, (int) $this->session->get('user_id'));

            return redirect()->to('/locations')->with('message', 'Lokasjon slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}

