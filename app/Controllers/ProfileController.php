<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\CrewDirectoryService;
use App\Services\ProfileService;

class ProfileController extends BaseController
{
    public function __construct(
        private readonly ProfileService $profile = new ProfileService(),
        private readonly CrewDirectoryService $crewDirectory = new CrewDirectoryService()
    )
    {
    }

    public function redirectToOwn()
    {
        $userId = (int) $this->session->get('user_id');
        $wannabeId = $this->profile->wannabeIdForUser($userId);
        if ($wannabeId === null) {
            return redirect()->to('/dashboard')->with('error', 'Brukeren mangler wannabe-id.');
        }

        return redirect()->to('/profil/' . $wannabeId);
    }

    public function index(int $wannabeId)
    {
        $userId = (int) $this->session->get('user_id');
        try {
            return view('profile/index', $this->profile->profileData($userId, $wannabeId));
        } catch (\Throwable $e) {
            $ownWannabeId = $this->profile->wannabeIdForUser($userId);
            $fallback = $ownWannabeId !== null ? '/profil/' . $ownWannabeId : '/dashboard';
            return redirect()->to($fallback)->with('error', $e->getMessage());
        }
    }

    public function changePassword()
    {
        try {
            $userId = (int) $this->session->get('user_id');
            $this->profile->changePassword($userId, $this->request->getPost());
            $wannabeId = $this->profile->wannabeIdForUser($userId);
            $target = $wannabeId !== null ? '/profil/' . $wannabeId : '/dashboard';

            return redirect()->to($target)->with('message', 'Passord oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function picture(int $wannabeId)
    {
        if ($wannabeId < 1) {
            return $this->response->setStatusCode(404);
        }

        if (! $this->profile->canShowPictureForWannabeId($wannabeId)) {
            return $this->response->setStatusCode(404);
        }

        $picture = $this->crewDirectory->pictureByWannabeId($wannabeId);
        if ($picture === null) {
            return $this->response->setStatusCode(404);
        }

        return $this->response
            ->setHeader('Content-Type', $picture['contentType'])
            ->setHeader('Cache-Control', 'private, max-age=900')
            ->setBody($picture['body']);
    }
}
