export interface WelcomeMailInput {
  appName: string;
  userName: string;
  loginUrl: string;
  roles: string[];
}

export function buildWelcomeMail(input: WelcomeMailInput): { subject: string; text: string; html: string } {
  const roles = input.roles.length ? input.roles.join(", ") : "Bruker";
  const loginLine = input.loginUrl ? `\nLogg inn: ${input.loginUrl}` : "";
  const subject = `Du er lagt til i ${input.appName}`;
  const text = `Hei ${input.userName}!\n\nDu er opprettet som bruker i ${input.appName}.\nRoller: ${roles}.${loginLine}\n\nBruk The Gathering SSO for å logge inn.`;
  const loginHtml = input.loginUrl
    ? `<p><a href="${escapeHtml(input.loginUrl)}">Logg inn i ${escapeHtml(input.appName)}</a></p>`
    : "";
  const html = `<p>Hei ${escapeHtml(input.userName)}!</p><p>Du er opprettet som bruker i ${escapeHtml(input.appName)}.</p><p><strong>Roller:</strong> ${escapeHtml(roles)}</p>${loginHtml}<p>Bruk The Gathering SSO for å logge inn.</p>`;
  return { subject, text, html };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    "\"": "&quot;",
  })[character] ?? character);
}
