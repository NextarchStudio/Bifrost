<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\ProfileService;

class ProfileController extends BaseController
{
    public function __construct(private readonly ProfileService $profile = new ProfileService())
    {
    }

    public function index()
    {
        $userId = (int) $this->session->get('user_id');

        return view('profile/index', $this->profile->profileData($userId));
    }

    public function changePassword()
    {
        try {
            $userId = (int) $this->session->get('user_id');
            $this->profile->changePassword($userId, $this->request->getPost());

            return redirect()->to('/profile')->with('message', 'Passord oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }
}

