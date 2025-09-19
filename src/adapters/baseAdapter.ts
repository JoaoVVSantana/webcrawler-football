import { Adapter, PageType } from '../types.js';

export abstract class BaseAdapter implements Adapter {
  abstract domain: string;
  abstract whitelistPatterns: RegExp[];

  classify(url: string): PageType {
    const u = url.toLowerCase();
    if (u.includes('onde-assistir')) return 'onde-assistir';
    if (u.includes('agenda') || u.includes('calend') || u.includes('tabela') || u.includes('rodada')) return 'agenda';
    return 'outro';
  }

  abstract extract(html: string, url: string): ReturnType<Adapter['extract']>;
}
