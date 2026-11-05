import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import nodemailer from 'nodemailer';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface Mailer {
  readonly kind: 'smtp' | 'file' | 'memory';
  send(message: MailMessage): Promise<void>;
}

export interface SmtpOptions {
  host: string;
  port: number;
  secure: boolean;
  user: string | null;
  password: string | null;
}

export function createSmtpMailer(options: SmtpOptions, from: string): Mailer {
  const transport = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    requireTLS: !options.secure,
    auth: options.user ? { user: options.user, pass: options.password ?? '' } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
    tls: { minVersion: 'TLSv1.2' },
  });
  return {
    kind: 'smtp',
    send: async (message) => {
      await transport.sendMail({ from, ...message });
    },
  };
}

export function createFileMailer(directory: string, from: string): Mailer {
  return {
    kind: 'file',
    send: async (message) => {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      const stamp = new Date().toISOString().replace(/[:.]/g, '-');
      const base = join(directory, `${stamp}-${message.to.replace(/[^a-z0-9]+/gi, '_')}`);
      const header = `De : ${from}\nÀ : ${message.to}\nObjet : ${message.subject}\n\n`;
      await writeFile(`${base}.txt`, header + message.text, { mode: 0o600 });
      await writeFile(`${base}.html`, message.html, { mode: 0o600 });
      const link = /https?:\/\/\S+/.exec(message.text)?.[0];
      console.log(
        `E-mail de développement pour ${message.to} : « ${message.subject} »${link ? ` → ${link}` : ''}`,
      );
    },
  };
}
