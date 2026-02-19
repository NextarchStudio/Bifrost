<?php
declare(strict_types=1);

namespace App\Controllers;

use App\Services\LoanService;

class LoansController extends BaseController
{
    public function __construct(private readonly LoanService $loans = new LoanService())
    {
    }

    public function index()
    {
        $search = trim((string) $this->request->getGet('q'));

        return view('loans/index', [
            'activeLoans' => $this->loans->active($search),
            'search'      => $search,
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

    public function returnLoan(int $loanId)
    {
        try {
            $this->loans->returnLoan($loanId, (int) $this->session->get('user_id'));
            return redirect()->to('/loans')->with('message', 'Utstyr returnert.');
        } catch (\Throwable $e) {
            return redirect()->back()->with('error', $e->getMessage());
        }
    }
}
