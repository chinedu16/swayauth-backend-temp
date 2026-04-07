import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomUUID,
} from 'crypto';

export const generateRandomUUID = () => randomUUID();

export const genOrgToken = (): string => {
  return randomUUID() + '.organization';
};

export const Encrypt = (str?: string): string => {
  try {
    const algorithm = 'aes-256-cbc';
    const key = createHash('sha512')
      .update(process.env.JWT_SECRET, 'utf-8')
      .digest('hex')
      .substring(0, 32);
    const iv = createHash('sha512')
      .update(process.env.JWT_SECRET, 'utf-8')
      .digest('hex')
      .substring(0, 16);
    const encryptor = createCipheriv(algorithm, key, iv);
    const aes_encrypted =
      encryptor.update(str, 'utf8', 'base64') + encryptor.final('base64');
    return Buffer.from(aes_encrypted).toString('base64').replaceAll('=', '_');
  } catch (error: any) {
    return '';
  }
};

export const randomNumber = (min: number, max: number): number =>
  Math.random() * (max - min) + min;

export const generateAppKey = (email: string): string => {
  return `${Math.floor(Date.now() / 1000)}-${Encrypt(email).replaceAll('=', '').replaceAll('_', '')}.app`;
};

export const Decrypt = (
  str?: string,
  secret = process.env.JWT_SECRET as string,
): string => {
  try {
    if (str) {
      str = str.replaceAll('_', '=');
    }
    const algorithm = 'aes-256-cbc';
    const key = createHash('sha512')
      .update(secret, 'utf-8')
      .digest('hex')
      .substring(0, 32);
    const iv = createHash('sha512')
      .update(secret, 'utf-8')
      .digest('hex')
      .substring(0, 16);
    const buffer = Buffer.from(str, 'base64');
    str = buffer.toString('utf-8');
    const decryptor = createDecipheriv(algorithm, key, iv);
    return decryptor.update(str, 'base64', 'utf8') + decryptor.final('utf8');
  } catch (error: any) {
    return null;
  }
};
