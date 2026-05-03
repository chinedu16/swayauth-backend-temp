import { promisify } from 'util';
import { exec } from 'child_process';

const shell = promisify(exec);

export const terminal = async (command: string) => {
  return (await shell(command)).stdout.trim();
};

export const getNamedServer = (output: string) => {
  const pos = output.indexOf('nameserver = ');
  const end = output.indexOf('\n', pos + 1);
  return output.substring(pos + 13, end - 1);
};

export const domainNameServer = async () => {
  const shell = await terminal('nslookup -type=NS swayauth.com');
  return getNamedServer(shell);
};

export const verifyAwsTxtRecord = async (domain: string) => {
  try {
    const nameServer = await domainNameServer();
    const shell = await terminal(
      `nslookup -type=TXT _amazonses.${domain} ${nameServer}`,
    );
    if (shell.indexOf(`server can't find`) > -1) {
      return false;
    }
    return true;
  } catch (error: any) {
    return false;
  }
};
