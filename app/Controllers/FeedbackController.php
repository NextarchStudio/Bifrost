<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\FeedbackService;
use CodeIgniter\HTTP\ResponseInterface;

class FeedbackController extends BaseController
{
    public function __construct(private readonly FeedbackService $feedback = new FeedbackService())
    {
    }

    public function index()
    {
        if ($response = $this->ensureFeedbackAccess()) {
            return $response;
        }

        $canViewAll = hasRole(['developer', 'logistikk']);
        $canManageAll = hasRole('developer');

        return view('feedback/index', $this->feedback->pageData((int) $this->session->get('user_id'), $canViewAll, $canManageAll));
    }

    public function create()
    {
        if ($response = $this->ensureFeedbackAccess()) {
            return $response;
        }

        try {
            $this->feedback->create(
                (array) $this->request->getPost(),
                (int) $this->session->get('user_id'),
                $this->request->getFile('attachment')
            );

            return redirect()->to('/feedback')->with('message', 'Tilbakemelding sendt til utvikler.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function updateStatus(int $entryId)
    {
        if ($response = $this->ensureFeedbackAccess()) {
            return $response;
        }

        try {
            requireRole('developer');
            $this->feedback->updateStatus($entryId, (array) $this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/feedback')->with('message', 'Tilbakemelding oppdatert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function delete(int $entryId)
    {
        if ($response = $this->ensureFeedbackAccess()) {
            return $response;
        }

        try {
            $this->feedback->deleteOwn($entryId, (int) $this->session->get('user_id'));

            return redirect()->to('/feedback')->with('message', 'Tilbakemelding slettet.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }

    public function notifications()
    {
        return $this->response->setJSON(
            $this->feedback->notificationPayload((int) $this->session->get('user_id'))
        );
    }

    public function markNotificationsRead()
    {
        $this->feedback->markNotificationsAsRead((int) $this->session->get('user_id'));

        return $this->response->setJSON([
            'ok' => true,
            'csrfHash' => csrf_hash(),
        ]);
    }

    public function attachment(int $entryId)
    {
        if ($response = $this->ensureFeedbackAccess()) {
            return $response;
        }

        try {
            $file = $this->feedback->attachmentForUser(
                $entryId,
                (int) $this->session->get('user_id'),
                hasRole(['developer', 'logistikk'])
            );

            if ($file === null) {
                throw \CodeIgniter\Exceptions\PageNotFoundException::forPageNotFound();
            }

            return $this->response
                ->setHeader('Content-Type', $file['mime'])
                ->setHeader('Content-Disposition', 'inline; filename="' . addslashes($file['name']) . '"')
                ->setBody((string) file_get_contents($file['path']));
        } catch (\CodeIgniter\Exceptions\PageNotFoundException $e) {
            throw $e;
        } catch (\Throwable $e) {
            throw \CodeIgniter\Exceptions\PageNotFoundException::forPageNotFound();
        }
    }

    private function ensureFeedbackAccess(): ?ResponseInterface
    {
        if (! hasRole('ingen_tilbakemeldinger')) {
            return null;
        }

        if ($this->request->isAJAX()) {
            return $this->response
                ->setStatusCode(403)
                ->setJSON([
                    'ok' => false,
                    'message' => 'Tilbakemeldinger er sperret for denne brukeren.',
                    'csrfHash' => csrf_hash(),
                ]);
        }

        return redirect()
            ->to('/dashboard')
            ->with('error', 'Tilbakemeldinger er sperret for denne brukeren.');
    }
}
