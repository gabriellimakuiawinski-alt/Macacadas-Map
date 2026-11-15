import * as Application from 'expo-application';

const LATEST_URL = 'https://api.github.com/repos/gabriellimakuiawinski-alt/Macacadas-Map/releases/latest';

export type UpdateInfo = {
  version: number;
  url: string;
  notes: string;
};

/** Número da versão instalada (= número do build no GitHub). */
export function currentVersion(): number {
  return Number(Application.nativeBuildVersion ?? '0') || 0;
}

/** Procura uma versão mais nova na aba Releases do GitHub. Devolve null se já está atualizado. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  try {
    const res = await fetch(LATEST_URL, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    const rel = (await res.json()) as {
      tag_name?: string;
      body?: string | null;
      assets?: { name: string; browser_download_url: string }[];
    };
    const version = Number(String(rel.tag_name ?? '').replace(/\D/g, '')) || 0;
    const apk = rel.assets?.find((a) => a.name.endsWith('.apk'));
    if (!apk || version <= currentVersion()) return null;
    return { version, url: apk.browser_download_url, notes: (rel.body ?? '').trim() };
  } catch {
    return null;
  }
}
