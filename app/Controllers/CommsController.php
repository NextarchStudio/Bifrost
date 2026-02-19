<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\CommsService;

class CommsController extends BaseController
{
    public function __construct(private readonly CommsService $comms = new CommsService())
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

    public function issue()
    {
        try {
            $this->comms->issue($this->request->getPost(), (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Samband-lån registrert.');
        } catch (\Throwable $e) {
            return redirect()->back()->withInput()->with('error', $e->getMessage());
        }
    }

    public function returnLoan(int $loanId)
    {
        try {
            $this->comms->returnLoan($loanId, (int) $this->session->get('user_id'));

            return redirect()->to('/samband')->with('message', 'Samband-lån returnert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
