<?php
declare(strict_types=1);

namespace App\Services;

use App\Repositories\SettingsRepository;

class AccountEmailService
{
    public function __construct(private readonly SettingsRepository $settings = new SettingsRepository())
    {
    }

    public function sendPasswordLink(string $emailAddress, string $name, string $link, string $purpose): void
    {
        $settings = $this->settings->get();

        if (empty($settings->smtp_host) || empty($settings->smtp_user) || empty($settings->smtp_pass) || empty($settings->smtp_port)) {
            throw new \RuntimeException('SMTP er ikke konfigurert i Administrasjon.');
        }

        $smtpUser = trim((string) $settings->smtp_user);
        $replyToEmail = trim((string) ($settings->smtp_from_email ?? ''));
        $appName = trim((string) ($settings->app_name ?? ''));
        if ($appName === '') {
            $appName = 'Bifrost';
        }

        $replyToName = trim((string) ($settings->smtp_from_name ?? $appName));
        $fromName = $replyToName !== '' ? $replyToName : $appName;

        $email = service('email', null, false);
        $email->initialize([
            'protocol' => 'smtp',
            'SMTPHost' => (string) $settings->smtp_host,
            'SMTPPort' => (int) $settings->smtp_port,
            'SMTPUser' => $smtpUser,
            'SMTPPass' => (string) $settings->smtp_pass,
            'SMTPCrypto' => (string) ($settings->smtp_crypto ?? 'tls'),
            'mailType' => 'text',
            'charset' => 'UTF-8',
            'newline' => "\r\n",
            'CRLF' => "\r\n",
        ]);

        $email->setFrom($smtpUser, $fromName);
        if ($replyToEmail !== '' && strcasecmp($replyToEmail, $smtpUser) !== 0) {
            $email->setReplyTo($replyToEmail, $replyToName);
        }

        $email->setTo($emailAddress);
        $email->setSubject($purpose === 'invite' ? 'Velg passord for ' . $appName : 'Tilbakestill passord for ' . $appName);

        $intro = $purpose === 'invite'
            ? 'En bruker er opprettet til deg i ' . $appName . '. Klikk på lenken under for å velge passord og aktivere lokal innlogging.'
            : 'Vi mottok en forespørsel om å tilbakestille passordet ditt i ' . $appName . '. Klikk på lenken under for å velge nytt passord.';

        $message = implode("\n\n", [
            'Hei ' . trim($name) . ',',
            $intro,
            $link,
            'Lenken utløper om 2 timer.',
            'Hvis du ikke forventet denne e-posten, kan du se bort fra den.',
        ]);

        $email->setMessage($message);

        if (! $email->send()) {
            $debug = trim(strip_tags((string) $email->printDebugger(['headers'])));
            throw new \RuntimeException($debug !== '' ? $debug : 'Kunne ikke sende e-post.');
        }
    }
}
