import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Client, Company, User } from '@prisma/client';
import { DurationEnum } from '../type/common';

export const ExcludeKeys = <T extends object = any>(
  data: T,
  ex: (keyof typeof data)[] = [],
) => {
  for (let i = 0; i < ex.length; i++) {
    delete data[ex[i]];
  }
  return data;
};

export const decodeHtmlEntity = function (str: string) {
  return str.replace(/&#(\d+);/g, function (match, dec) {
    return String.fromCharCode(dec);
  });
};

export const encodeHtmlEntity = function (str: string) {
  const buf = [];
  for (let i = str.length - 1; i >= 0; i--) {
    buf.unshift(['&#', str[i].charCodeAt(0), ';'].join(''));
  }
  return buf.join('');
};

export const verifyUserAuthorization = async (
  user: (User | Client) & { company: Company },
): Promise<void> => {
  if (
    !user ||
    user?.status === 'disabled' ||
    user?.company?.status !== 'active'
  )
    throw new NotFoundException('Account does not exist');
  else if (!user.verified)
    throw new ForbiddenException('Account is not verified');
};

export const rangeGenerator = (start: number, end: number) => {
  const oneDay = 1000 * 60 * 60 * 24;
  return {
    lte: new Date(Date.now() - oneDay * start),
    gte: new Date(Date.now() - oneDay * end),
  };
};

export const multipleDateRangeQuery = (
  date: DurationEnum,
  company_id: string,
) => {
  if (date === DurationEnum['7_days']) {
    return Array(7)
      .fill(0)
      .map((_, i) => ({
        where: {
          company_id,
          created_at: rangeGenerator(i, i + 1),
        },
      }));
  }
};

export const sleep = (seconds: number): Promise<boolean> =>
  new Promise((resolve) => {
    setTimeout(() => resolve(true), seconds * 1000);
  });

export const dateRange = (date: DurationEnum) => {
  const newDate = new Date();
  const oneDay = 1000 * 60 * 60 * 24;
  const range = {
    gte: newDate,
    lte: newDate,
  };
  if (date === DurationEnum['7_days']) {
    range.gte = new Date(Date.now() - oneDay * 7);
  } else if (date === DurationEnum['14_days']) {
    range.gte = new Date(Date.now() - oneDay * 14);
  } else if (date === DurationEnum['30_days']) {
    range.gte = new Date(Date.now() - oneDay * 30);
  } else if (date === DurationEnum['6_months']) {
    range.gte = new Date(Date.now() - oneDay * 182);
  } else if (date === DurationEnum['1_year']) {
    range.gte = new Date(Date.now() - oneDay * 365);
  }
  return range;
};
