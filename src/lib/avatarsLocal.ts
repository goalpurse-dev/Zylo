export type AvatarShot = { scene: string; file: string; url: string };
export type AvatarIdentity = { id: string; label: string; shots: AvatarShot[] };

export async function loadLocalAvatars(): Promise<AvatarIdentity[]> {
  const res = await fetch('/avatars/index.json', { cache: 'no-store' });
  const data = await res.json();
  const base = '/avatars/';
  return data.identities.map((idObj: any) => ({
    ...idObj,
    shots: idObj.shots.map((s: any) => ({
      ...s,
      url: base + s.file
    }))
  }));
}
